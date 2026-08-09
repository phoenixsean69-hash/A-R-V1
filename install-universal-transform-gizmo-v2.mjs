import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root =
  process.cwd();

const scriptDir =
  path.dirname(
    fileURLToPath(
      import.meta.url,
    ),
  );

const packagePath =
  path.join(
    root,
    "package.json",
  );

const reconstructionTypesPath =
  path.join(
    root,
    "src/types/reconstruction.ts",
  );

const editorPath =
  path.join(
    root,
    "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  );

const viewerPath =
  path.join(
    root,
    "src/components/reconstruction/Reconstruction3DViewer.tsx",
  );

const environmentPath =
  path.join(
    root,
    "src/components/reconstruction/RoadSceneEnvironment.tsx",
  );

const realLayerPath =
  path.join(
    root,
    "src/components/reconstruction/RealSceneGeometryLayer.tsx",
  );

const newTypePath =
  path.join(
    root,
    "src/types/reconstructionTransform.ts",
  );

const newUtilPath =
  path.join(
    root,
    "src/utils/realSceneFeatureTransform.ts",
  );

const newGizmoPath =
  path.join(
    root,
    "src/components/reconstruction/UniversalTransformGizmo2D.tsx",
  );

const newCssPath =
  path.join(
    root,
    "src/components/reconstruction/universalTransformGizmo.css",
  );

const payloadType =
  path.join(
    scriptDir,
    "reconstructionTransform.ts",
  );

const payloadUtil =
  path.join(
    scriptDir,
    "realSceneFeatureTransform.ts",
  );

const payloadGizmo =
  path.join(
    scriptDir,
    "UniversalTransformGizmo2D.tsx",
  );

const payloadCss =
  path.join(
    scriptDir,
    "universalTransformGizmo.css",
  );

const backupRoot =
  path.join(
    root,
    ".roadsafe-ui-backup",
  );

const statePath =
  path.join(
    backupRoot,
    "last-universal-transform-gizmo-v2.json",
  );

const buildLogPath =
  path.join(
    backupRoot,
    "universal-transform-gizmo-v2-build.log",
  );

function fail(
  message,
) {
  console.error(
    message,
  );

  process.exit(
    1,
  );
}

function normaliseSourceEol(
  source,
) {
  return source
    .replace(
      /\r\n/g,
      "\n",
    )
    .replace(
      /\r/g,
      "\n",
    );
}

function detectSourceEol(
  source,
) {
  return source.includes(
    "\r\n",
  )
    ? "\r\n"
    : "\n";
}

function restoreSourceEol(
  source,
  original,
) {
  const eol =
    detectSourceEol(
      original,
    );

  return eol ===
    "\n"
    ? source
    : source.replace(
        /\n/g,
        eol,
      );
}

function insertAfter(
  source,
  anchor,
  content,
  label,
) {
  const index =
    source.indexOf(
      anchor,
    );

  if (
    index <
    0
  ) {
    fail(
      `Could not locate ${label}. No files changed.`,
    );
  }

  return (
    source.slice(
      0,
      index +
        anchor.length,
    ) +
    content +
    source.slice(
      index +
        anchor.length,
    )
  );
}

function insertBefore(
  source,
  anchor,
  content,
  label,
) {
  const index =
    source.indexOf(
      anchor,
    );

  if (
    index <
    0
  ) {
    fail(
      `Could not locate ${label}. No files changed.`,
    );
  }

  return (
    source.slice(
      0,
      index,
    ) +
    content +
    source.slice(
      index,
    )
  );
}

function replaceOnce(
  source,
  before,
  after,
  label,
) {
  const first =
    source.indexOf(
      before,
    );

  if (
    first <
    0
  ) {
    fail(
      `Could not locate ${label}. No files changed.`,
    );
  }

  return (
    source.slice(
      0,
      first,
    ) +
    after +
    source.slice(
      first +
        before.length,
    )
  );
}

if (
  !fs.existsSync(
    packagePath,
  )
) {
  fail(
    "Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1",
  );
}

const pkg =
  JSON.parse(
    fs.readFileSync(
      packagePath,
      "utf8",
    ),
  );

if (
  pkg.name !==
  "roadsafe-ar"
) {
  fail(
    `Expected roadsafe-ar, found ${pkg.name ?? "unknown"}.`,
  );
}

for (
  const required of [
    reconstructionTypesPath,
    editorPath,
    viewerPath,
    environmentPath,
    realLayerPath,
    payloadType,
    payloadUtil,
    payloadGizmo,
    payloadCss,
  ]
) {
  if (
    !fs.existsSync(
      required,
    )
  ) {
    fail(
      `Required file missing: ${required}`,
    );
  }
}

const originals = {
  reconstructionTypes:
    fs.readFileSync(
      reconstructionTypesPath,
      "utf8",
    ),

  editor:
    fs.readFileSync(
      editorPath,
      "utf8",
    ),

  viewer:
    fs.readFileSync(
      viewerPath,
      "utf8",
    ),

  environment:
    fs.readFileSync(
      environmentPath,
      "utf8",
    ),

  realLayer:
    fs.readFileSync(
      realLayerPath,
      "utf8",
    ),

  newType:
    fs.existsSync(
      newTypePath,
    )
      ? fs.readFileSync(
          newTypePath,
          "utf8",
        )
      : null,

  newUtil:
    fs.existsSync(
      newUtilPath,
    )
      ? fs.readFileSync(
          newUtilPath,
          "utf8",
        )
      : null,

  newGizmo:
    fs.existsSync(
      newGizmoPath,
    )
      ? fs.readFileSync(
          newGizmoPath,
          "utf8",
        )
      : null,

  newCss:
    fs.existsSync(
      newCssPath,
    )
      ? fs.readFileSync(
          newCssPath,
          "utf8",
        )
      : null,
};

let reconstructionTypes =
  normaliseSourceEol(
    originals.reconstructionTypes,
  );

let editor =
  normaliseSourceEol(
    originals.editor,
  );

let viewer =
  normaliseSourceEol(
    originals.viewer,
  );

let environment =
  normaliseSourceEol(
    originals.environment,
  );

let realLayer =
  normaliseSourceEol(
    originals.realLayer,
  );

console.log(
  "Source line-ending normalisation audit: PASS",
);

/* ====================================================================== */
/* 1. Canonical data model.                                                */
/* ====================================================================== */

if (
  !reconstructionTypes.includes(
    'from "./reconstructionTransform";',
  )
) {
  const firstImportEnd =
    reconstructionTypes.indexOf(
      "\n",
      reconstructionTypes.indexOf(
        'from "./realSceneGeometry";',
      ),
    );

  if (
    firstImportEnd <
    0
  ) {
    fail(
      "Could not locate reconstruction type import seam. No files changed.",
    );
  }

  reconstructionTypes =
    reconstructionTypes.slice(
      0,
      firstImportEnd +
        1,
    ) +
`import type {
  RealSceneFeatureTransform,
} from "./reconstructionTransform";
` +
    reconstructionTypes.slice(
      firstImportEnd +
        1,
    );
}

if (
  !reconstructionTypes.includes(
    "visualScale?: number;",
  )
) {
  const assetMarker =
    "  assetId?: ReconstructionParticipantAssetId;";

  reconstructionTypes =
    insertAfter(
      reconstructionTypes,
      assetMarker,
`
  /**
   * Investigator-controlled visual/model scale.
   * Physics dimensions remain separately controlled by ParticipantPhysicsProfile.
   */
  visualScale?: number;`,
      "participant assetId property",
    );
}

if (
  !reconstructionTypes.includes(
    "realSceneFeatureTransforms?: RealSceneFeatureTransform[];",
  )
) {
  const forensicMarker =
    "  forensicScene?: ForensicScenePackage;";

  reconstructionTypes =
    insertAfter(
      reconstructionTypes,
      forensicMarker,
`
  /**
   * Non-destructive investigator transforms layered over immutable source geometry.
   */
  realSceneFeatureTransforms?: RealSceneFeatureTransform[];`,
      "RoadSceneSettings forensicScene property",
    );
}

if (
  !reconstructionTypes.includes(
    "realSceneFeatureTransforms: [],",
  )
) {
  const defaultMarker =
    '    sceneEnvironment: "Road / Junction",';

  reconstructionTypes =
    insertBefore(
      reconstructionTypes,
      defaultMarker,
      "    realSceneFeatureTransforms: [],\n",
      "default scene environment",
    );
}

/* ====================================================================== */
/* 2. RoadSceneEnvironment applies corrections + selection.               */
/* ====================================================================== */

if (
  !environment.includes(
    'from "../../utils/realSceneFeatureTransform";',
  )
) {
  environment =
    `import { useMemo } from "react";
import type {
  RealSceneFeatureSelection,
} from "../../types/reconstructionTransform";
import {
  applyRealSceneFeatureTransforms,
} from "../../utils/realSceneFeatureTransform";
` +
    environment;
}

if (
  !environment.includes(
    "selectedRealSceneFeature?:",
  )
) {
  const propsClose =
    environment.indexOf(
      "\n}",
      environment.indexOf(
        "interface RoadSceneEnvironmentProps",
      ),
    );

  if (
    propsClose <
    0
  ) {
    fail(
      "Could not locate RoadSceneEnvironmentProps. No files changed.",
    );
  }

  environment =
    environment.slice(
      0,
      propsClose,
    ) +
`
  selectedRealSceneFeature?:
    RealSceneFeatureSelection | null;

  onSelectRealSceneFeature?:
    (
      selection:
        RealSceneFeatureSelection,
    ) => void;
` +
    environment.slice(
      propsClose,
    );
}

if (
  !environment.includes(
    "const sourceRealSceneGeometry",
  )
) {
  const functionStart =
    environment.indexOf(
      "export default function RoadSceneEnvironment",
    );

  if (
    functionStart <
    0
  ) {
    fail(
      "Could not locate RoadSceneEnvironment function. No files changed.",
    );
  }

  /*
   * Patch the function parameters structurally. Earlier RoadSafe installers may
   * have changed wrapping/spacing around the signature.
   */
  const signatureOpen =
    environment.indexOf(
      "(",
      functionStart,
    );

  const signatureClose =
    environment.indexOf(
      "):",
      signatureOpen,
    );

  const bodyBrace =
    environment.indexOf(
      "{",
      signatureClose,
    );

  if (
    signatureOpen <
      0 ||
    signatureClose <
      0 ||
    bodyBrace <
      0
  ) {
    fail(
      "Could not structurally isolate RoadSceneEnvironment signature. No files changed.",
    );
  }

  const signatureText =
    environment.slice(
      signatureOpen +
        1,
      signatureClose,
    );

  if (
    !signatureText.includes(
      "RoadSceneEnvironmentProps",
    )
  ) {
    fail(
      "RoadSceneEnvironment signature no longer uses RoadSceneEnvironmentProps. No files changed.",
    );
  }

  environment =
    environment.slice(
      0,
      signatureOpen +
        1,
    ) +
`{
  settings,
  selectedRealSceneFeature = null,
  onSelectRealSceneFeature,
}: RoadSceneEnvironmentProps` +
    environment.slice(
      signatureClose +
        1,
    );

  /*
   * Find the declaration that actually references
   * `settings.realSceneGeometry?.status`, regardless of whitespace or whether
   * another installer wrapped it differently.
   */
  const statusMarker =
    "settings.realSceneGeometry?.status";

  const statusIndex =
    environment.indexOf(
      statusMarker,
      functionStart,
    );

  if (
    statusIndex <
    0
  ) {
    fail(
      "Could not locate RoadSceneEnvironment real-scene status expression. No files changed.",
    );
  }

  const declarationStart =
    environment.lastIndexOf(
      "const ",
      statusIndex,
    );

  const declarationEnd =
    environment.indexOf(
      ";",
      statusIndex,
    );

  if (
    declarationStart <
      0 ||
    declarationEnd <
      0
  ) {
    fail(
      "Could not structurally isolate RoadSceneEnvironment real-scene declaration. No files changed.",
    );
  }

  const existingDeclaration =
    environment.slice(
      declarationStart,
      declarationEnd +
        1,
    );

  const variableMatch =
    existingDeclaration.match(
      /const\s+([A-Za-z_$][\w$]*)\s*=/,
    );

  if (
    !variableMatch
  ) {
    fail(
      "Could not determine RoadSceneEnvironment real-scene variable name. No files changed.",
    );
  }

  const existingVariable =
    variableMatch[1];

  const replacementDeclaration =
`const sourceRealSceneGeometry =
    settings.realSceneGeometry?.status === "ready"
      ? settings.realSceneGeometry
      : null;

  const realSceneGeometry =
    useMemo(
      () =>
        sourceRealSceneGeometry
          ? applyRealSceneFeatureTransforms(
              sourceRealSceneGeometry,
              settings.realSceneFeatureTransforms,
            )
          : null,
      [
        settings.realSceneFeatureTransforms,
        sourceRealSceneGeometry,
      ],
    );`;

  environment =
    environment.slice(
      0,
      declarationStart,
    ) +
    replacementDeclaration +
    environment.slice(
      declarationEnd +
        1,
    );

  /*
   * Normally the existing variable is `realSceneGeometry`. If a prior patch
   * renamed it, rewrite only references inside this function body after the
   * new declaration so the existing render branch still consumes the corrected
   * geometry variable.
   */
  if (
    existingVariable !==
    "realSceneGeometry"
  ) {
    const bodyStart =
      environment.indexOf(
        replacementDeclaration,
        declarationStart,
      ) +
      replacementDeclaration.length;

    const beforeBody =
      environment.slice(
        0,
        bodyStart,
      );

    const functionTail =
      environment.slice(
        bodyStart,
      );

    environment =
      beforeBody +
      functionTail.replace(
        new RegExp(
          `\\b${existingVariable}\\b`,
          "g",
        ),
        "realSceneGeometry",
      );
  }
}

if (
  !environment.includes(
    "const sourceRealSceneGeometry",
  ) ||
  !environment.includes(
    "applyRealSceneFeatureTransforms(",
  )
) {
  fail(
    "RoadSceneEnvironment corrected-geometry wiring audit failed. No files changed.",
  );
}

console.log(
  "RoadSceneEnvironment structural correction seam audit: PASS",
);

if (
  !environment.includes(
    "selectedFeature={selectedRealSceneFeature}",
  )
) {
  const layer =
    '<RealSceneGeometryLayer geometry={realSceneGeometry} settings={settings} />';

  if (
    !environment.includes(
      layer,
    )
  ) {
    fail(
      "Could not locate RealSceneGeometryLayer render. No files changed.",
    );
  }

  environment =
    environment.replace(
      layer,
`<RealSceneGeometryLayer
          geometry={realSceneGeometry}
          settings={settings}
          selectedFeature={selectedRealSceneFeature}
          onSelectFeature={onSelectRealSceneFeature}
        />`,
    );
}

/* ====================================================================== */
/* 3. Selectable extracted geometry.                                      */
/* ====================================================================== */

if (
  !realLayer.includes(
    'from "../../types/reconstructionTransform";',
  )
) {
  realLayer =
    `import type {
  RealSceneFeatureSelection,
} from "../../types/reconstructionTransform";
` +
    realLayer;
}

if (
  !realLayer.includes(
    "selectedFeature?:",
  )
) {
  const propsClose =
    realLayer.indexOf(
      "\n}",
      realLayer.indexOf(
        "interface RealSceneGeometryLayerProps",
      ),
    );

  if (
    propsClose <
    0
  ) {
    fail(
      "Could not locate RealSceneGeometryLayerProps. No files changed.",
    );
  }

  realLayer =
    realLayer.slice(
      0,
      propsClose,
    ) +
`
  selectedFeature?:
    RealSceneFeatureSelection | null;

  onSelectFeature?:
    (
      selection:
        RealSceneFeatureSelection,
    ) => void;
` +
    realLayer.slice(
      propsClose,
    );
}

if (
  !realLayer.includes(
    "selectedFeature = null",
  )
) {
  const functionStart =
    realLayer.indexOf(
      "export default function RealSceneGeometryLayer",
    );

  const propsMarker =
    ": RealSceneGeometryLayerProps)";

  const propsEnd =
    realLayer.indexOf(
      propsMarker,
      functionStart,
    );

  const destructureOpen =
    realLayer.indexOf(
      "{",
      functionStart,
    );

  const destructureClose =
    realLayer.lastIndexOf(
      "}",
      propsEnd,
    );

  if (
    functionStart <
      0 ||
    propsEnd <
      0 ||
    destructureOpen <
      0 ||
    destructureClose <
      destructureOpen
  ) {
    fail(
      "Could not structurally isolate RealSceneGeometryLayer signature. No files changed.",
    );
  }

  realLayer =
    realLayer.slice(
      0,
      destructureOpen +
        1,
    ) +
`
  geometry,
  settings,
  selectedFeature = null,
  onSelectFeature,
` +
    realLayer.slice(
      destructureClose,
    );
}

console.log(
  "RealSceneGeometryLayer structural signature audit: PASS",
);

if (
  !realLayer.includes(
    "roadsafe-real-scene-hit-layer",
  )
) {
  const boundaryAnchor =
`        <rect
          x="0.18"`;

  const boundaryIndex =
    realLayer.indexOf(
      boundaryAnchor,
    );

  if (
    boundaryIndex <
    0
  ) {
    fail(
      "Could not locate selected-area boundary in RealSceneGeometryLayer. No files changed.",
    );
  }

  const hitLayer =
`        {onSelectFeature && (
          <g
            className="roadsafe-real-scene-hit-layer"
            data-scene-interactive="true"
          >
            {landCover.map((cover) => {
              const selected =
                selectedFeature?.kind === "land-cover" &&
                selectedFeature.featureId === cover.id;

              return (
                <path
                  key={\`hit-land-cover-\${cover.id}\`}
                  d={polygonFromLocalPoints(cover.localPoints, geometry)}
                  fill="rgba(255,255,255,.001)"
                  stroke={selected ? "#e8872d" : "rgba(0,0,0,.001)"}
                  strokeWidth={selected ? 0.65 : 1.6}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="all"
                  data-roadsafe-real-feature-selected={selected ? "true" : undefined}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectFeature({
                      kind: "land-cover",
                      featureId: cover.id,
                    });
                  }}
                />
              );
            })}

            {geometry.buildings.map((building) => {
              const selected =
                selectedFeature?.kind === "building" &&
                selectedFeature.featureId === building.id;

              return (
                <path
                  key={\`hit-building-\${building.id}\`}
                  d={polygonFromLocalPoints(building.localPoints, geometry)}
                  fill="rgba(255,255,255,.001)"
                  stroke={selected ? "#e8872d" : "rgba(0,0,0,.001)"}
                  strokeWidth={selected ? 0.7 : 1.4}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="all"
                  data-roadsafe-real-feature-selected={selected ? "true" : undefined}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectFeature({
                      kind: "building",
                      featureId: building.id,
                    });
                  }}
                />
              );
            })}

            {roads.map(({ road, centrePath }) => {
              const selected =
                selectedFeature?.kind === "road" &&
                selectedFeature.featureId === road.id;

              return (
                <path
                  key={\`hit-road-\${road.id}\`}
                  d={centrePath}
                  fill="none"
                  stroke={selected ? "#e8872d" : "rgba(0,0,0,.001)"}
                  strokeWidth={selected ? 1.1 : 2.5}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="stroke"
                  data-roadsafe-real-feature-selected={selected ? "true" : undefined}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectFeature({
                      kind: "road",
                      featureId: road.id,
                    });
                  }}
                />
              );
            })}

            {geometry.paths.map((path) => {
              const selected =
                selectedFeature?.kind === "path" &&
                selectedFeature.featureId === path.id;

              return (
                <path
                  key={\`hit-path-\${path.id}\`}
                  d={pathData(
                    sampleSmoothPath(
                      path.localPoints.map(localPoint),
                      false,
                    ).map((point) => toPercent(point, geometry)),
                  )}
                  fill="none"
                  stroke={selected ? "#e8872d" : "rgba(0,0,0,.001)"}
                  strokeWidth={selected ? 0.9 : 2.2}
                  pointerEvents="stroke"
                  vectorEffect="non-scaling-stroke"
                  data-roadsafe-real-feature-selected={selected ? "true" : undefined}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectFeature({
                      kind: "path",
                      featureId: path.id,
                    });
                  }}
                />
              );
            })}

            {geometry.barriers.map((barrier) => {
              const selected =
                selectedFeature?.kind === "barrier" &&
                selectedFeature.featureId === barrier.id;

              return (
                <path
                  key={\`hit-barrier-\${barrier.id}\`}
                  d={pathData(
                    barrier.localPoints.map((point) =>
                      toPercent(localPoint(point), geometry),
                    ),
                  )}
                  fill="none"
                  stroke={selected ? "#e8872d" : "rgba(0,0,0,.001)"}
                  strokeWidth={selected ? 0.9 : 2}
                  pointerEvents="stroke"
                  vectorEffect="non-scaling-stroke"
                  data-roadsafe-real-feature-selected={selected ? "true" : undefined}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectFeature({
                      kind: "barrier",
                      featureId: barrier.id,
                    });
                  }}
                />
              );
            })}

            {vegetation.map((plant) => {
              const position =
                toPercent(
                  localPoint(
                    plant.localPosition,
                  ),
                  geometry,
                );

              const selected =
                selectedFeature?.kind === "vegetation" &&
                selectedFeature.featureId === plant.id;

              return (
                <circle
                  key={\`hit-vegetation-\${plant.id}\`}
                  cx={position.x}
                  cy={position.y}
                  r={selected ? 1.55 : 1.2}
                  fill="rgba(255,255,255,.001)"
                  stroke={selected ? "#e8872d" : "rgba(0,0,0,.001)"}
                  strokeWidth={selected ? 0.5 : 0.2}
                  pointerEvents="all"
                  vectorEffect="non-scaling-stroke"
                  data-roadsafe-real-feature-selected={selected ? "true" : undefined}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectFeature({
                      kind: "vegetation",
                      featureId: plant.id,
                    });
                  }}
                />
              );
            })}
          </g>
        )}

`;

  realLayer =
    realLayer.slice(
      0,
      boundaryIndex,
    ) +
    hitLayer +
    realLayer.slice(
      boundaryIndex,
    );
}

/* ====================================================================== */
/* 4. 2D editor universal gizmo.                                          */
/* ====================================================================== */

if (
  !editor.includes(
    'from "../../types/reconstructionTransform";',
  )
) {
  const importAnchor =
    'import type { ReconstructionFootage } from "../../types/reconstructionFootage";';

  editor =
    replaceOnce(
      editor,
      importAnchor,
`${importAnchor}
import type {
  RealSceneFeatureSelection,
  UniversalTransformValue,
} from "../../types/reconstructionTransform";
import {
  applyRealSceneFeatureTransforms,
  getCorrectedRealSceneFeatureAnchor,
  getRealSceneFeatureAnchor,
  getRealSceneFeatureTransform,
  upsertRealSceneFeatureTransform,
} from "../../utils/realSceneFeatureTransform";`,
      "reconstructionFootage import",
    );
}

if (
  !editor.includes(
    'import UniversalTransformGizmo2D from "./UniversalTransformGizmo2D";',
  )
) {
  const importAnchor =
    'import ReconstructionGuide from "./ReconstructionGuide";';

  editor =
    replaceOnce(
      editor,
      importAnchor,
`${importAnchor}
import UniversalTransformGizmo2D from "./UniversalTransformGizmo2D";`,
      "ReconstructionGuide import",
    );
}

if (
  !editor.includes(
    "selectedRealSceneFeature",
  )
) {
  const stateAnchor =
`  const [selectedSceneObjectId, setSelectedSceneObjectId] = useState<
    string | null
  >(reconstruction.sceneObjects[0]?.id ?? null);`;

  if (
    !editor.includes(
      stateAnchor,
    )
  ) {
    fail(
      "Could not locate selectedSceneObjectId state. No files changed.",
    );
  }

  editor =
    insertAfter(
      editor,
      stateAnchor,
`
  const [
    selectedRealSceneFeature,
    setSelectedRealSceneFeature,
  ] = useState<RealSceneFeatureSelection | null>(
    null,
  );`,
      "selected scene object state",
    );
}

if (
  !editor.includes(
    "const correctedRealSceneGeometry",
  )
) {
  const selectedObjectMemo =
`  const selectedSceneObject = useMemo(
    () =>
      reconstruction.sceneObjects.find(
        (object) => object.id === selectedSceneObjectId,
      ) ?? null,
    [reconstruction.sceneObjects, selectedSceneObjectId],
  );`;

  if (
    !editor.includes(
      selectedObjectMemo,
    )
  ) {
    fail(
      "Could not locate selectedSceneObject memo. No files changed.",
    );
  }

  editor =
    insertAfter(
      editor,
      selectedObjectMemo,
`

  const correctedRealSceneGeometry =
    useMemo(
      () =>
        reconstruction.scene.realSceneGeometry
          ? applyRealSceneFeatureTransforms(
              reconstruction.scene.realSceneGeometry,
              reconstruction.scene.realSceneFeatureTransforms,
            )
          : null,
      [
        reconstruction.scene.realSceneFeatureTransforms,
        reconstruction.scene.realSceneGeometry,
      ],
    );

  const selectedRealSceneSourceAnchor =
    useMemo(
      () =>
        reconstruction.scene.realSceneGeometry &&
        selectedRealSceneFeature
          ? getRealSceneFeatureAnchor(
              reconstruction.scene.realSceneGeometry,
              selectedRealSceneFeature,
            )
          : null,
      [
        reconstruction.scene.realSceneGeometry,
        selectedRealSceneFeature,
      ],
    );

  const selectedRealSceneAnchor =
    useMemo(
      () =>
        reconstruction.scene.realSceneGeometry &&
        selectedRealSceneFeature
          ? getCorrectedRealSceneFeatureAnchor(
              reconstruction.scene.realSceneGeometry,
              reconstruction.scene.realSceneFeatureTransforms,
              selectedRealSceneFeature,
            )
          : null,
      [
        reconstruction.scene.realSceneFeatureTransforms,
        reconstruction.scene.realSceneGeometry,
        selectedRealSceneFeature,
      ],
    );

  const selectedRealSceneTransform =
    useMemo(
      () =>
        getRealSceneFeatureTransform(
          reconstruction.scene.realSceneFeatureTransforms,
          selectedRealSceneFeature,
        ),
      [
        reconstruction.scene.realSceneFeatureTransforms,
        selectedRealSceneFeature,
      ],
    );`,
      "selected scene object memo",
    );
}

if (
  !editor.includes(
    "const updateSelectedRealSceneFeatureTransform",
  )
) {
  const updateSceneObjectAnchor =
`  const updateSceneObject = useCallback(
`;

  const index =
    editor.indexOf(
      updateSceneObjectAnchor,
    );

  if (
    index <
    0
  ) {
    fail(
      "Could not locate updateSceneObject callback. No files changed.",
    );
  }

  const helper =
`  const updateSelectedRealSceneFeatureTransform =
    useCallback(
      (
        next:
          UniversalTransformValue,
      ) => {
        if (
          !selectedRealSceneFeature ||
          !selectedRealSceneSourceAnchor ||
          !reconstruction.scene.realSceneGeometry
        ) {
          return;
        }

        const scene =
          reconstruction.scene;

        const width =
          scene.realSceneGeometry.sceneWidthMetres;

        const height =
          scene.realSceneGeometry.sceneHeightMetres;

        const translationEastMetres =
          (
            (
              next.position.x -
              selectedRealSceneSourceAnchor.x
            ) /
            100
          ) *
          width;

        const translationNorthMetres =
          -(
            (
              next.position.y -
              selectedRealSceneSourceAnchor.y
            ) /
            100
          ) *
          height;

        const correction = {
          schemaVersion:
            "RoadSafe Real Scene Transform V1" as const,

          featureId:
            selectedRealSceneFeature.featureId,

          featureKind:
            selectedRealSceneFeature.kind,

          translationEastMetres,
          translationNorthMetres,

          rotationDegrees:
            next.rotationDegrees,

          scale:
            next.scale,

          correctedAt:
            new Date().toISOString(),
        };

        setReconstruction(
          (
            current,
          ) => ({
            ...current,

            lastPhysicsSimulation:
              undefined,

            scene: {
              ...current.scene,

              realSceneFeatureTransforms:
                upsertRealSceneFeatureTransform(
                  current.scene.realSceneFeatureTransforms,
                  correction,
                ),
            },
          }),
        );
      },
      [
        reconstruction.scene,
        selectedRealSceneFeature,
        selectedRealSceneSourceAnchor,
      ],
    );

`;

  editor =
    editor.slice(
      0,
      index,
    ) +
    helper +
    editor.slice(
      index,
    );
}

if (
  !editor.includes(
    'selectedRealSceneFeature={selectedRealSceneFeature}',
  )
) {
  const oldRoadEnvironment =
    '<RoadSceneEnvironment settings={reconstruction.scene} />';

  if (
    !editor.includes(
      oldRoadEnvironment,
    )
  ) {
    fail(
      "Could not locate RoadSceneEnvironment in 2D editor. No files changed.",
    );
  }

  editor =
    editor.replace(
      oldRoadEnvironment,
`<RoadSceneEnvironment
                  settings={reconstruction.scene}
                  selectedRealSceneFeature={selectedRealSceneFeature}
                  onSelectRealSceneFeature={(selection) => {
                    setSelectedRealSceneFeature(selection);
                    setSelectedParticipantId(null);
                    setSelectedPathPointId(null);
                    setSelectedSceneObjectId(null);
                    setSelectedEvidenceId(null);
                    setSelectedMeasurementId(null);
                  }}
                />`,
    );
}

if (
  !editor.includes(
    'data-roadsafe-transform-plane="true"',
  )
) {
  const roadIndex =
    editor.indexOf(
      "<RoadSceneEnvironment",
    );

  const divStart =
    editor.lastIndexOf(
      "<div",
      roadIndex,
    );

  const divEnd =
    editor.indexOf(
      ">",
      divStart,
    );

  if (
    divStart <
      0 ||
    divEnd <
      0
  ) {
    fail(
      "Could not locate 2D transform plane opening div. No files changed.",
    );
  }

  editor =
    editor.slice(
      0,
      divEnd,
    ) +
    '\n                data-roadsafe-transform-plane="true"' +
    editor.slice(
      divEnd,
    );
}

if (
  !editor.includes(
    "<UniversalTransformGizmo2D",
  )
) {
  const gizmoAnchor =
    `              {collisionPlacementActive && (`;

  const gizmoIndex =
    editor.indexOf(
      gizmoAnchor,
    );

  if (
    gizmoIndex <
    0
  ) {
    fail(
      "Could not locate 2D gizmo render seam. No files changed.",
    );
  }

  const gizmo =
`              {!isPlaying &&
                (
                  activeWorkspaceTool === "Move" ||
                  activeWorkspaceTool === "Rotate" ||
                  activeWorkspaceTool === "Scale"
                ) &&
                (() => {
                  if (
                    selectedSceneObject
                  ) {
                    return (
                      <UniversalTransformGizmo2D
                        mode={activeWorkspaceTool}
                        label={selectedSceneObject.label}
                        value={{
                          position: selectedSceneObject.position,
                          rotationDegrees: selectedSceneObject.rotation,
                          scale: selectedSceneObject.scale,
                        }}
                        disabled={selectedSceneObject.locked}
                        onChange={(next) =>
                          updateSceneObject(
                            selectedSceneObject.id,
                            {
                              position:
                                activeWorkspaceTool === "Move"
                                  ? next.position
                                  : undefined,
                              rotation:
                                activeWorkspaceTool === "Rotate"
                                  ? next.rotationDegrees
                                  : undefined,
                              scale:
                                activeWorkspaceTool === "Scale"
                                  ? next.scale
                                  : undefined,
                            },
                          )
                        }
                      />
                    );
                  }

                  if (
                    selectedParticipant &&
                    selectedParticipantState
                  ) {
                    const activePoint =
                      selectedParticipant.pathPoints.find(
                        (point) =>
                          point.id ===
                          selectedParticipantState.activePointId,
                      );

                    const pointTransformLocked =
                      !activePoint ||
                      !canBeginRoutePointDrag(activePoint);

                    return (
                      <UniversalTransformGizmo2D
                        mode={activeWorkspaceTool}
                        label={selectedParticipant.name}
                        value={{
                          position:
                            selectedParticipantState.position,
                          rotationDegrees:
                            selectedParticipantState.rotation,
                          scale:
                            selectedParticipant.visualScale ?? 1,
                        }}
                        disabled={
                          activeWorkspaceTool !== "Scale" &&
                          pointTransformLocked
                        }
                        onChange={(next) => {
                          if (
                            activeWorkspaceTool === "Scale"
                          ) {
                            updateParticipant(
                              selectedParticipant.id,
                              {
                                visualScale:
                                  next.scale,
                              },
                            );

                            return;
                          }

                          if (
                            !activePoint ||
                            pointTransformLocked
                          ) {
                            return;
                          }

                          updatePathPoint(
                            selectedParticipant.id,
                            activePoint.id,
                            activeWorkspaceTool === "Move"
                              ? {
                                  position:
                                    next.position,
                                }
                              : {
                                  rotation:
                                    next.rotationDegrees,
                                },
                          );
                        }}
                      />
                    );
                  }

                  if (
                    selectedRealSceneFeature &&
                    selectedRealSceneAnchor
                  ) {
                    return (
                      <UniversalTransformGizmo2D
                        mode={activeWorkspaceTool}
                        label={selectedRealSceneFeature.kind}
                        value={{
                          position:
                            selectedRealSceneAnchor,
                          rotationDegrees:
                            selectedRealSceneTransform?.rotationDegrees ?? 0,
                          scale:
                            selectedRealSceneTransform?.scale ?? 1,
                        }}
                        onChange={
                          updateSelectedRealSceneFeatureTransform
                        }
                      />
                    );
                  }

                  return null;
                })()}

`;

  editor =
    editor.slice(
      0,
      gizmoIndex,
    ) +
    gizmo +
    editor.slice(
      gizmoIndex,
    );
}

/* Participant visual scale in 2D. */
if (
  !editor.includes(
    "participant.visualScale ?? 1",
  )
) {
  const transformSnippet =
`transform: \`translate(-50%, -50%) translate(\${shakeX}px, \${shakeY}px) rotate(\${state.rotation + rotationShake}deg)\`,`;


  if (
    !editor.includes(
      transformSnippet,
    )
  ) {
    fail(
      "Could not locate participant 2D transform style. No files changed.",
    );
  }

  editor =
    editor.replace(
      transformSnippet,
`transform: \`translate(-50%, -50%) translate(\${shakeX}px, \${shakeY}px) rotate(\${state.rotation + rotationShake}deg) scale(\${participant.visualScale ?? 1})\`,`,
    );
}

/* ====================================================================== */
/* 5. 3D TransformControls for participants + scene objects.               */
/* ====================================================================== */

if (
  !viewer.includes(
    'from "../../utils/realSceneFeatureTransform";',
  )
) {
  const importAnchor =
    'import { getReconstructionWorldDimensions } from "../../utils/reconstructionWorldScale";';

  if (
    !viewer.includes(
      importAnchor,
    )
  ) {
    fail(
      "Could not locate reconstructionWorldScale import for corrected 3D real-scene geometry. No files changed.",
    );
  }

  viewer =
    viewer.replace(
      importAnchor,
`${importAnchor}
import {
  applyRealSceneFeatureTransforms,
} from "../../utils/realSceneFeatureTransform";`,
    );
}

/*
 * Apply the same non-destructive real-scene corrections in 3D that the 2D
 * environment consumes. Environmental features are precision-edited with the
 * 2D gizmo in V1, and 3D immediately renders the corrected geometry.
 */
if (
  !viewer.includes(
    "const extractedSource = reconstruction.scene.realSceneGeometry",
  )
) {
  const oldExtracted =
`    const extracted = reconstruction.scene.realSceneGeometry?.status === "ready"
      ? reconstruction.scene.realSceneGeometry
      : null;`;

  if (
    viewer.includes(
      oldExtracted,
    )
  ) {
    viewer =
      viewer.replace(
        oldExtracted,
`    const extractedSource =
      reconstruction.scene.realSceneGeometry?.status === "ready"
        ? reconstruction.scene.realSceneGeometry
        : null;

    const extracted =
      extractedSource
        ? applyRealSceneFeatureTransforms(
            extractedSource,
            reconstruction.scene.realSceneFeatureTransforms,
          )
        : null;`,
      );
  } else {
    /*
     * Terrain-completeness patches may already have changed formatting around
     * the extracted geometry declaration. Insert corrected assignment by
     * structurally locating the existing realSceneGeometry status expression.
     */
    const marker =
      "reconstruction.scene.realSceneGeometry?.status";

    const markerIndex =
      viewer.indexOf(
        marker,
      );

    if (
      markerIndex <
      0
    ) {
      fail(
        "Could not locate 3D real-scene extraction declaration. No files changed.",
      );
    }

    const constStart =
      viewer.lastIndexOf(
        "const extracted",
        markerIndex,
      );

    const semicolon =
      viewer.indexOf(
        ";",
        markerIndex,
      );

    if (
      constStart <
        0 ||
      semicolon <
        0
    ) {
      fail(
        "Could not isolate 3D extracted geometry declaration. No files changed.",
      );
    }

    const originalDeclaration =
      viewer.slice(
        constStart,
        semicolon +
          1,
      );

    const expressionStart =
      originalDeclaration.indexOf(
        "=",
      );

    const expression =
      originalDeclaration
        .slice(
          expressionStart +
            1,
          -1,
        )
        .trim();

    viewer =
      viewer.slice(
        0,
        constStart,
      ) +
`const extractedSource =
      ${expression};

    const extracted =
      extractedSource
        ? applyRealSceneFeatureTransforms(
            extractedSource,
            reconstruction.scene.realSceneFeatureTransforms,
          )
        : null;` +
      viewer.slice(
        semicolon +
          1,
      );
  }
}

if (
  !viewer.includes(
    "TransformControls",
  )
) {
  const orbitImport =
    'import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";';

  viewer =
    replaceOnce(
      viewer,
      orbitImport,
`${orbitImport}
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";`,
      "OrbitControls import",
    );
}

if (
  !viewer.includes(
    "selectedSceneObjectId?:",
  )
) {
  const propsAnchor =
`  onSelectParticipant?: (participantId: string) => void;`;

  viewer =
    insertAfter(
      viewer,
      propsAnchor,
`
  selectedSceneObjectId?: string | null;
  onSelectSceneObject?: (objectId: string) => void;

  onTransformParticipant?: (
    participantId: string,
    next: {
      position: ReconstructionPosition;
      rotationDegrees: number;
      scale: number;
    },
  ) => void;

  onTransformSceneObject?: (
    objectId: string,
    next: {
      position: ReconstructionPosition;
      rotationDegrees: number;
      scale: number;
    },
  ) => void;`,
      "3D participant selection props",
    );
}

if (
  !viewer.includes(
    "selectedSceneObjectId = null",
  )
) {
  const destructureAnchor =
`  selectedParticipantId = null,
  onSelectParticipant,`;

  viewer =
    replaceOnce(
      viewer,
      destructureAnchor,
`  selectedParticipantId = null,
  onSelectParticipant,
  selectedSceneObjectId = null,
  onSelectSceneObject,
  onTransformParticipant,
  onTransformSceneObject,`,
      "3D viewer selection destructure",
    );
}

if (
  !viewer.includes(
    "selectedSceneObjectRef",
  )
) {
  const refAnchor =
`  const selectedRef = useRef<string | null>(selectedParticipantId);
  const onSelectRef = useRef(onSelectParticipant);`;

  viewer =
    replaceOnce(
      viewer,
      refAnchor,
`${refAnchor}
  const selectedSceneObjectRef =
    useRef<string | null>(
      selectedSceneObjectId,
    );
  const onSelectSceneObjectRef =
    useRef(onSelectSceneObject);
  const onTransformParticipantRef =
    useRef(onTransformParticipant);
  const onTransformSceneObjectRef =
    useRef(onTransformSceneObject);`,
      "3D selection refs",
    );

  const effectAnchor =
`  useEffect(() => {
    onSelectRef.current = onSelectParticipant;
  }, [onSelectParticipant]);`;

  viewer =
    insertAfter(
      viewer,
      effectAnchor,
`
  useEffect(() => {
    selectedSceneObjectRef.current =
      selectedSceneObjectId;
  }, [selectedSceneObjectId]);

  useEffect(() => {
    onSelectSceneObjectRef.current =
      onSelectSceneObject;
  }, [onSelectSceneObject]);

  useEffect(() => {
    onTransformParticipantRef.current =
      onTransformParticipant;
  }, [onTransformParticipant]);

  useEffect(() => {
    onTransformSceneObjectRef.current =
      onTransformSceneObject;
  }, [onTransformSceneObject]);`,
      "3D selection effect",
    );
}

if (
  !viewer.includes(
    "sceneObjectEntries",
  )
) {
  const mapAnchor =
    "    const participantEntries = new Map<string, ParticipantRenderEntry>();";

  viewer =
    insertAfter(
      viewer,
      mapAnchor,
`
    const sceneObjectEntries =
      new Map<
        string,
        THREE.Group
      >();`,
      "3D participant entries map",
    );
}

if (
  !viewer.includes(
    "holder.userData.sceneObjectId",
  )
) {
  const holderAnchor =
`          const holder = new THREE.Group();
          const fallback = createFallbackSceneObject(object);`;

  viewer =
    replaceOnce(
      viewer,
      holderAnchor,
`          const holder = new THREE.Group();
          holder.userData.sceneObjectId =
            object.id;
          const fallback = createFallbackSceneObject(object);`,
      "3D scene object holder",
    );

  const addAnchor =
`          scene.add(holder);
          void loadRealisticSceneObjectModel(object)`;

  viewer =
    replaceOnce(
      viewer,
      addAnchor,
`          holder.traverse((child) => {
            child.userData.sceneObjectId =
              object.id;
          });

          scene.add(holder);
          sceneObjectEntries.set(
            object.id,
            holder,
          );

          void loadRealisticSceneObjectModel(object)`,
      "3D scene object add",
    );
}

if (
  !viewer.includes(
    "participant.visualScale ?? 1",
  )
) {
  const participantEntryAnchor =
`      const entry = createParticipantHolder(participant);
      scene.add(entry.holder);`;

  viewer =
    replaceOnce(
      viewer,
      participantEntryAnchor,
`      const entry = createParticipantHolder(participant);
      entry.holder.scale.setScalar(
        participant.visualScale ?? 1,
      );
      scene.add(entry.holder);`,
      "3D participant holder creation",
    );
}

if (
  !viewer.includes(
    "const transformControls =",
  )
) {
  const raycasterAnchor =
    "    const raycaster = new THREE.Raycaster();";

  const gizmo3d =
`    let gizmoDragging =
      false;

    const transformControls =
      new TransformControls(
        camera,
        renderer.domElement,
      );

    const transformHelper =
      transformControls.getHelper();

    transformHelper.visible =
      false;

    scene.add(
      transformHelper,
    );

    const selectedParticipantEntry =
      selectedRef.current
        ? participantEntries.get(
            selectedRef.current,
          )
        : undefined;

    const selectedObjectEntry =
      selectedSceneObjectRef.current
        ? sceneObjectEntries.get(
            selectedSceneObjectRef.current,
          )
        : undefined;

    const editableTarget =
      selectedObjectEntry ??
      selectedParticipantEntry?.holder;

    if (
      editableTarget &&
      (
        workspaceTool === "Move" ||
        workspaceTool === "Rotate" ||
        workspaceTool === "Scale"
      )
    ) {
      transformHelper.visible =
        true;

      transformControls.setMode(
        workspaceTool === "Move"
          ? "translate"
          : workspaceTool === "Rotate"
            ? "rotate"
            : "scale",
      );

      transformControls.setSpace(
        "world",
      );

      transformControls.attach(
        editableTarget,
      );
    }

    const handleTransformDraggingChanged =
      (
        event: {
          value:
            unknown;
        },
      ) => {
        gizmoDragging =
          Boolean(
            event.value,
          );

        controls.enabled =
          !gizmoDragging &&
          cameraModeRef.current ===
            "Orbit";
      };

    transformControls.addEventListener(
      "dragging-changed",
      handleTransformDraggingChanged,
    );

    transformControls.addEventListener(
      "mouseUp",
      () => {
        const participantId =
          selectedRef.current;

        const objectId =
          selectedSceneObjectRef.current;

        if (
          objectId
        ) {
          const holder =
            sceneObjectEntries.get(
              objectId,
            );

          if (
            holder
          ) {
            const position = {
              x:
                clamp(
                  (
                    holder.position.x /
                      width +
                    0.5
                  ) *
                    100,
                  0,
                  100,
                ),

              y:
                clamp(
                  (
                    holder.position.z /
                      height +
                    0.5
                  ) *
                    100,
                  0,
                  100,
                ),
            };

            onTransformSceneObjectRef.current?.(
              objectId,
              {
                position,

                rotationDegrees:
                  (
                    -THREE.MathUtils.radToDeg(
                      holder.rotation.y,
                    ) +
                    360
                  ) %
                  360,

                scale:
                  Math.max(
                    0.2,
                    holder.scale.x,
                  ),
              },
            );
          }

          return;
        }

        if (
          participantId
        ) {
          const entry =
            participantEntries.get(
              participantId,
            );

          if (
            entry
          ) {
            const position = {
              x:
                clamp(
                  (
                    entry.holder.position.x /
                      width +
                    0.5
                  ) *
                    100,
                  0,
                  100,
                ),

              y:
                clamp(
                  (
                    entry.holder.position.z /
                      height +
                    0.5
                  ) *
                    100,
                  0,
                  100,
                ),
            };

            onTransformParticipantRef.current?.(
              participantId,
              {
                position,

                rotationDegrees:
                  (
                    -THREE.MathUtils.radToDeg(
                      entry.holder.rotation.y,
                    ) +
                    360
                  ) %
                  360,

                scale:
                  Math.max(
                    0.2,
                    entry.holder.scale.x,
                  ),
              },
            );
          }
        }
      },
    );

`;

  viewer =
    insertBefore(
      viewer,
      raycasterAnchor,
      gizmo3d,
      "3D raycaster creation",
    );
}

/* Click participants OR scene objects. */
if (
  !viewer.includes(
    "onSelectSceneObjectRef.current?.",
  )
) {
  const oldPointer =
`      const hit = raycaster
        .intersectObjects(
          [...participantEntries.values()].map((entry) => entry.holder),
          true,
        )
        .find((intersection) => {
          let current: THREE.Object3D | null = intersection.object;
          while (current) {
            if (current.userData.participantId) return true;
            current = current.parent;
          }
          return false;
        });
      if (!hit) return;
      let current: THREE.Object3D | null = hit.object;
      while (current && !current.userData.participantId) current = current.parent;
      const id = current?.userData.participantId as string | undefined;
      if (id) onSelectRef.current(id);`;

  if (
    !viewer.includes(
      oldPointer,
    )
  ) {
    fail(
      "Could not locate 3D pointer selection logic. No files changed.",
    );
  }

  const newPointer =
`      const hit = raycaster
        .intersectObjects(
          [
            ...participantEntries.values().map(
              (entry) => entry.holder,
            ),
            ...sceneObjectEntries.values(),
          ],
          true,
        )
        .find((intersection) => {
          let current:
            THREE.Object3D | null =
            intersection.object;

          while (current) {
            if (
              current.userData.participantId ||
              current.userData.sceneObjectId
            ) {
              return true;
            }

            current =
              current.parent;
          }

          return false;
        });

      if (!hit) return;

      let current:
        THREE.Object3D | null =
        hit.object;

      while (
        current &&
        !current.userData.participantId &&
        !current.userData.sceneObjectId
      ) {
        current =
          current.parent;
      }

      const participantId =
        current?.userData.participantId as
          | string
          | undefined;

      const sceneObjectId =
        current?.userData.sceneObjectId as
          | string
          | undefined;

      if (
        sceneObjectId
      ) {
        onSelectSceneObjectRef.current?.(
          sceneObjectId,
        );

        return;
      }

      if (
        participantId
      ) {
        onSelectRef.current?.(
          participantId,
        );
      }`;

  viewer =
    viewer.replace(
      oldPointer,
      newPointer,
    );
}

/* Do not overwrite participant holder while its gizmo is being dragged. */
if (
  !viewer.includes(
    "gizmoDragging &&",
  )
) {
  const animationAnchor =
`      participantEntries.forEach((entry) => {
        const state = getParticipantStateAtTime(`;

  if (
    !viewer.includes(
      animationAnchor,
    )
  ) {
    fail(
      "Could not locate 3D participant animation loop. No files changed.",
    );
  }

  viewer =
    viewer.replace(
      animationAnchor,
`      participantEntries.forEach((entry) => {
        if (
          gizmoDragging &&
          selectedRef.current ===
            entry.participant.id
        ) {
          return;
        }

        const state = getParticipantStateAtTime(`,
    );
}

if (
  !viewer.includes(
    "transformControls.dispose();",
  )
) {
  const cleanupAnchor =
    "      controls.dispose();";

  viewer =
    replaceOnce(
      viewer,
      cleanupAnchor,
`      transformControls.detach();
      transformControls.dispose();
      scene.remove(transformHelper);
${cleanupAnchor}`,
      "3D controls cleanup",
    );
}

/* ====================================================================== */
/* 6. Wire 3D gizmo callbacks from parent.                                */
/* ====================================================================== */

if (
  !editor.includes(
    "onTransformSceneObject={(objectId, next)",
  )
) {
  const viewerPropAnchor =
`                  onSelectParticipant={(participantId) =>
                    handleSelectParticipant(participantId)
                  }`;

  if (
    !editor.includes(
      viewerPropAnchor,
    )
  ) {
    fail(
      "Could not locate Reconstruction3DViewer selection props. No files changed.",
    );
  }

  const props =
`${viewerPropAnchor}
                  selectedSceneObjectId={selectedSceneObjectId}
                  onSelectSceneObject={(objectId) => {
                    handleSelectSceneObject(objectId);
                    setSelectedRealSceneFeature(null);
                  }}
                  onTransformSceneObject={(objectId, next) => {
                    setIsPlaying(false);

                    const currentObject =
                      reconstruction.sceneObjects.find(
                        (object) =>
                          object.id === objectId,
                      );

                    updateSceneObject(
                      objectId,
                      {
                        position:
                          activeWorkspaceTool === "Move"
                            ? next.position
                            : undefined,

                        rotation:
                          activeWorkspaceTool === "Rotate"
                            ? next.rotationDegrees
                            : undefined,

                        scale:
                          activeWorkspaceTool === "Scale" && currentObject
                            ? currentObject.scale * next.scale
                            : undefined,
                      },
                    );
                  }}
                  onTransformParticipant={(participantId, next) => {
                    setIsPlaying(false);

                    const participant =
                      reconstruction.vehicles.find(
                        (item) =>
                          item.id === participantId,
                      );

                    if (
                      !participant
                    ) {
                      return;
                    }

                    if (
                      activeWorkspaceTool === "Scale"
                    ) {
                      updateParticipant(
                        participantId,
                        {
                          visualScale:
                            next.scale,
                        },
                      );

                      return;
                    }

                    const state =
                      getParticipantStateAtTime(
                        participant,
                        currentTime,
                        getReconstructionWorldDimensions(
                          reconstruction,
                        ),
                      );

                    const point =
                      participant.pathPoints.find(
                        (candidate) =>
                          candidate.id ===
                          state.activePointId,
                      );

                    if (
                      !point ||
                      !canBeginRoutePointDrag(
                        point,
                      )
                    ) {
                      showSaveMessage(
                        "This participant point is locked. Select an editable authored route point.",
                        "info",
                        3000,
                      );

                      return;
                    }

                    updatePathPoint(
                      participantId,
                      point.id,
                      activeWorkspaceTool === "Move"
                        ? {
                            position:
                              next.position,
                          }
                        : {
                            rotation:
                              next.rotationDegrees,
                          },
                    );
                  }}`;

  editor =
    editor.replace(
      viewerPropAnchor,
      props,
    );
}

/* ====================================================================== */
/* 7. Verify source before write.                                         */
/* ====================================================================== */

for (
  const [
    label,
    source,
    tokens,
  ] of [
    [
      "reconstruction types",
      reconstructionTypes,
      [
        "visualScale?: number;",
        "realSceneFeatureTransforms?: RealSceneFeatureTransform[];",
      ],
    ],
    [
      "2D environment",
      environment,
      [
        "applyRealSceneFeatureTransforms",
        "selectedRealSceneFeature",
      ],
    ],
    [
      "real scene layer",
      realLayer,
      [
        "roadsafe-real-scene-hit-layer",
        'kind: "building"',
        'kind: "vegetation"',
        'kind: "road"',
      ],
    ],
    [
      "editor",
      editor,
      [
        "UniversalTransformGizmo2D",
        "selectedRealSceneFeature",
        "updateSelectedRealSceneFeatureTransform",
        'data-roadsafe-transform-plane="true"',
        "visualScale",
        "onTransformParticipant",
        "onTransformSceneObject",
      ],
    ],
    [
      "3D viewer",
      viewer,
      [
        "TransformControls",
        "applyRealSceneFeatureTransforms",
        "realSceneFeatureTransforms",
        "sceneObjectEntries",
        "transformControls.getHelper",
        "onTransformParticipantRef",
        "onTransformSceneObjectRef",
      ],
    ],
  ]
) {
  for (
    const token of
      tokens
  ) {
    if (
      !source.includes(
        token,
      )
    ) {
      fail(
        `${label} verification failed: ${token}. No files changed.`,
      );
    }
  }
}

if (
  environment.includes(
    "\r"
  ) ||
  editor.includes(
    "\r"
  ) ||
  viewer.includes(
    "\r"
  ) ||
  realLayer.includes(
    "\r"
  )
) {
  fail(
    "Internal line-ending normalisation failed. No files changed.",
  );
}

console.log(
  "Mixed-EOL resilience audit: PASS",
);

/* ====================================================================== */
/* 8. Parse all TS/TSX before touching repo.                              */
/* ====================================================================== */

const newType =
  fs.readFileSync(
    payloadType,
    "utf8",
  );

const newUtil =
  fs.readFileSync(
    payloadUtil,
    "utf8",
  );

const newGizmo =
  fs.readFileSync(
    payloadGizmo,
    "utf8",
  );

const newCss =
  fs.readFileSync(
    payloadCss,
    "utf8",
  );

try {
  const require =
    createRequire(
      import.meta.url,
    );

  const ts =
    require(
      "typescript",
    );

  const targets = [
    [
      "reconstruction.ts",
      reconstructionTypes,
      ts.ScriptKind.TS,
    ],
    [
      "AccidentReconstructionEditor.tsx",
      editor,
      ts.ScriptKind.TSX,
    ],
    [
      "Reconstruction3DViewer.tsx",
      viewer,
      ts.ScriptKind.TSX,
    ],
    [
      "RoadSceneEnvironment.tsx",
      environment,
      ts.ScriptKind.TSX,
    ],
    [
      "RealSceneGeometryLayer.tsx",
      realLayer,
      ts.ScriptKind.TSX,
    ],
    [
      "reconstructionTransform.ts",
      newType,
      ts.ScriptKind.TS,
    ],
    [
      "realSceneFeatureTransform.ts",
      newUtil,
      ts.ScriptKind.TS,
    ],
    [
      "UniversalTransformGizmo2D.tsx",
      newGizmo,
      ts.ScriptKind.TSX,
    ],
  ];

  for (
    const [
      name,
      source,
      kind,
    ] of
      targets
  ) {
    const file =
      ts.createSourceFile(
        name,
        source,
        ts.ScriptTarget.Latest,
        true,
        kind,
      );

    const diagnostics =
      file.parseDiagnostics ??
      [];

    if (
      diagnostics.length >
      0
    ) {
      const details =
        diagnostics
          .slice(
            0,
            20,
          )
          .map(
            (
              diagnostic,
            ) => {
              const message =
                ts.flattenDiagnosticMessageText(
                  diagnostic.messageText,
                  "\n",
                );

              if (
                typeof diagnostic.start !==
                "number"
              ) {
                return message;
              }

              const position =
                file.getLineAndCharacterOfPosition(
                  diagnostic.start,
                );

              return `${name}:${position.line + 1}:${position.character + 1} ${message}`;
            },
          )
          .join(
            "\n",
          );

      fail(
        `Universal gizmo TS/TSX parse failed:\n${details}`,
      );
    }
  }

  console.log(
    "Universal gizmo TS/TSX parse audit: PASS",
  );
} catch (
  error
) {
  if (
    String(
      error,
    ).includes(
      "Cannot find module 'typescript'",
    )
  ) {
    console.warn(
      "TypeScript parser unavailable; continuing to full build.",
    );
  } else {
    throw error;
  }
}

let cssDepth =
  0;

for (
  const character of
    newCss
) {
  if (
    character ===
    "{"
  ) {
    cssDepth +=
      1;
  }

  if (
    character ===
    "}"
  ) {
    cssDepth -=
      1;
  }

  if (
    cssDepth <
    0
  ) {
    fail(
      "Universal gizmo CSS brace audit failed. No files changed.",
    );
  }
}

if (
  cssDepth !==
  0
) {
  fail(
    "Universal gizmo CSS brace audit failed. No files changed.",
  );
}

/* ====================================================================== */
/* 9. Backup and write.                                                    */
/* ====================================================================== */

fs.mkdirSync(
  backupRoot,
  {
    recursive:
      true,
  },
);

fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      installedAt:
        new Date().toISOString(),

      originals,
    },
    null,
    2,
  ),
  "utf8",
);

function restoreOptional(
  target,
  content,
) {
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

function restore() {
  fs.writeFileSync(
    reconstructionTypesPath,
    originals.reconstructionTypes,
    "utf8",
  );

  fs.writeFileSync(
    editorPath,
    originals.editor,
    "utf8",
  );

  fs.writeFileSync(
    viewerPath,
    originals.viewer,
    "utf8",
  );

  fs.writeFileSync(
    environmentPath,
    originals.environment,
    "utf8",
  );

  fs.writeFileSync(
    realLayerPath,
    originals.realLayer,
    "utf8",
  );

  restoreOptional(
    newTypePath,
    originals.newType,
  );

  restoreOptional(
    newUtilPath,
    originals.newUtil,
  );

  restoreOptional(
    newGizmoPath,
    originals.newGizmo,
  );

  restoreOptional(
    newCssPath,
    originals.newCss,
  );

  fs.rmSync(
    statePath,
    {
      force:
        true,
    },
  );
}

fs.writeFileSync(
  reconstructionTypesPath,
  restoreSourceEol(
    reconstructionTypes,
    originals.reconstructionTypes,
  ),
  "utf8",
);

fs.writeFileSync(
  editorPath,
  restoreSourceEol(
    editor,
    originals.editor,
  ),
  "utf8",
);

fs.writeFileSync(
  viewerPath,
  restoreSourceEol(
    viewer,
    originals.viewer,
  ),
  "utf8",
);

fs.writeFileSync(
  environmentPath,
  restoreSourceEol(
    environment,
    originals.environment,
  ),
  "utf8",
);

fs.writeFileSync(
  realLayerPath,
  restoreSourceEol(
    realLayer,
    originals.realLayer,
  ),
  "utf8",
);

fs.writeFileSync(
  newTypePath,
  newType,
  "utf8",
);

fs.writeFileSync(
  newUtilPath,
  newUtil,
  "utf8",
);

fs.writeFileSync(
  newGizmoPath,
  newGizmo,
  "utf8",
);

fs.writeFileSync(
  newCssPath,
  newCss,
  "utf8",
);

console.log(
  "WROTE universal transform types + real-scene correction utility.",
);

console.log(
  "PATCHED 2D Move / Rotate / Scale gizmo.",
);

console.log(
  "PATCHED extracted roads/buildings/vegetation/paths/barriers/land-cover selection.",
);

console.log(
  "PATCHED 3D TransformControls for participants + scene objects.",
);

/* ====================================================================== */
/* 10. Full build.                                                        */
/* ====================================================================== */

console.log("");
console.log(
  "Running full project build...",
);

const command =
  process.platform ===
  "win32"
    ? {
        executable:
          process.env.ComSpec ||
          "C:\\Windows\\System32\\cmd.exe",

        args: [
          "/d",
          "/s",
          "/c",
          "npm run build",
        ],
      }
    : {
        executable:
          "npm",

        args: [
          "run",
          "build",
        ],
      };

const build =
  spawnSync(
    command.executable,
    command.args,
    {
      cwd:
        root,

      encoding:
        "utf8",

      shell:
        false,

      env:
        process.env,
    },
  );

const output =
  [
    "RoadSafe Universal Transform Gizmo V2",
    "=====================================",
    `status: ${String(
      build.status,
    )}`,
    `error: ${
      build.error
        ? `${build.error.name}: ${build.error.message}`
        : "none"
    }`,
    "",
    "STDOUT",
    "------",
    build.stdout ??
      "",
    "",
    "STDERR",
    "------",
    build.stderr ??
      "",
  ].join(
    "\n",
  );

fs.writeFileSync(
  buildLogPath,
  output,
  "utf8",
);

if (
  build.stdout
) {
  process.stdout.write(
    build.stdout,
  );
}

if (
  build.stderr
) {
  process.stderr.write(
    build.stderr,
  );
}

if (
  build.status ===
    null ||
  build.status !==
    0
) {
  console.error("");
  console.error(
    "Build failed. Restoring the previous reconstruction editor...",
  );

  restore();

  console.error(
    `Build log preserved at ${path.relative(
      root,
      buildLogPath,
    )}`,
  );

  process.exit(
    build.status ??
      1,
  );
}

console.log("");
console.log(
  "RoadSafe Universal Transform Gizmo V2 installed successfully.",
);

console.log("");
console.log(
  "2D:",
);

console.log(
  "  G = Move selected participant / scene object / extracted feature",
);

console.log(
  "  R = Rotate selected participant / scene object / extracted feature",
);

console.log(
  "  S = Scale selected participant / scene object / extracted feature",
);

console.log("");
console.log(
  "3D:",
);

console.log(
  "  Participants + scene objects use Three.js TransformControls.",
);

console.log("");
console.log(
  "Forensic rule:",
);

console.log(
  "  participant visualScale does NOT silently change physics dimensions.",
);

console.log(
  "  extracted source geometry stays immutable; corrections are stored separately.",
);

console.log("");
console.log(
  "Start / refresh:",
);

console.log(
  "  npm run dev",
);

console.log("");
console.log(
  "Rollback:",
);

console.log(
  "  node revoke-universal-transform-gizmo-v2.mjs",
);
