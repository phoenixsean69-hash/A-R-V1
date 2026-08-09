import fs from "node:fs";
import path from "node:path";

const root =
  process.cwd();

const statePath =
  path.join(
    root,
    ".roadsafe-ui-backup",
    "last-gizmo-only-v1.json",
  );

if (
  !fs.existsSync(
    statePath,
  )
) {
  console.error(
    "No Gizmo Only V1 backup state found.",
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

  fs.writeFileSync(
    target,
    content,
    "utf8",
  );
}

restore(
  "src/types/reconstruction.ts",
  originals.types,
);

restore(
  "src/components/reconstruction/Participant2DModel.tsx",
  originals.participant2D,
);

restore(
  "src/components/reconstruction/SceneObjectRenderer.tsx",
  originals.sceneObjectRenderer,
);

restore(
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  originals.editor,
);

restore(
  "src/components/reconstruction/Reconstruction3DViewer.tsx",
  originals.viewer,
);

restore(
  "src/components/reconstruction/TransformGizmo2D.tsx",
  originals.gizmo,
);

restore(
  "src/components/reconstruction/transformGizmo2D.css",
  originals.gizmoCss,
);

fs.rmSync(
  statePath,
  {
    force:
      true,
  },
);

console.log(
  "RoadSafe Gizmo Only V1 rolled back.",
);
