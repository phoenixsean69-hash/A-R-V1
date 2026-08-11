import fs from "node:fs";
import path from "node:path";

const root =
  process.cwd();

const statePath =
  path.join(
    root,
    ".roadsafe-ui-backup",
    "last-palette-everywhere-v1.json",
  );

if (
  !fs.existsSync(
    statePath,
  )
) {
  console.error(
    "No Palette Everywhere V1 backup state found.",
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

const originals =
  state.originals;

function restore(
  relativePath,
  content,
) {
  const target =
    path.join(
      root,
      relativePath,
    );

  if (
    content ===
    null
  ) {
    fs.rmSync(
      target,
      {
        force:
          true,
      },
    );

    return;
  }

  fs.mkdirSync(
    path.dirname(
      target,
    ),
    {
      recursive:
        true,
    },
  );

  fs.writeFileSync(
    target,
    content,
    "utf8",
  );
}

restore(
  "src/main.tsx",
  originals.main,
);

restore(
  "src/index.css",
  originals.indexCss,
);

restore(
  "src/styles/darkerTheme.css",
  originals.darkerTheme,
);

restore(
  "src/styles/workstationPanelSystem.css",
  originals.workstation,
);

restore(
  "src/styles/blenderColorGuard.css",
  originals.blenderGuard,
);

restore(
  "src/styles/roadsafePalette.css",
  originals.palette,
);

restore(
  "src/components/reconstruction/Reconstruction3DViewer.tsx",
  originals.viewer,
);

restore(
  "src/components/reconstruction/Participant2DModel.tsx",
  originals.participant2D,
);

for (
  const gizmo of
    originals.gizmos ??
    []
) {
  const relative =
    path.relative(
      root,
      gizmo.filePath,
    );

  restore(
    relative,
    gizmo.content,
  );
}

fs.rmSync(
  statePath,
  {
    force:
      true,
  },
);

console.log(
  "RoadSafe Palette Everywhere V1 rolled back.",
);
