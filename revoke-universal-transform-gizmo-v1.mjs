import fs from "node:fs";
import path from "node:path";

const root =
  process.cwd();

const statePath =
  path.join(
    root,
    ".roadsafe-ui-backup",
    "last-universal-transform-gizmo-v1.json",
  );

if (
  !fs.existsSync(
    statePath,
  )
) {
  console.error(
    "No Universal Transform Gizmo V1 backup state found.",
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

const write =
  (
    relativePath,
    content,
  ) => {
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
  };

write(
  "src/types/reconstruction.ts",
  originals.reconstructionTypes,
);

write(
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  originals.editor,
);

write(
  "src/components/reconstruction/Reconstruction3DViewer.tsx",
  originals.viewer,
);

write(
  "src/components/reconstruction/RoadSceneEnvironment.tsx",
  originals.environment,
);

write(
  "src/components/reconstruction/RealSceneGeometryLayer.tsx",
  originals.realLayer,
);

write(
  "src/types/reconstructionTransform.ts",
  originals.newType,
);

write(
  "src/utils/realSceneFeatureTransform.ts",
  originals.newUtil,
);

write(
  "src/components/reconstruction/UniversalTransformGizmo2D.tsx",
  originals.newGizmo,
);

write(
  "src/components/reconstruction/universalTransformGizmo.css",
  originals.newCss,
);

fs.rmSync(
  statePath,
  {
    force:
      true,
  },
);

console.log(
  "RoadSafe Universal Transform Gizmo V1 rolled back.",
);
