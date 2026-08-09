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

const typesPath =
  path.join(
    root,
    "src/types/reconstruction.ts",
  );

const participant2DPath =
  path.join(
    root,
    "src/components/reconstruction/Participant2DModel.tsx",
  );

const sceneObjectRendererPath =
  path.join(
    root,
    "src/components/reconstruction/SceneObjectRenderer.tsx",
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

const gizmoPath =
  path.join(
    root,
    "src/components/reconstruction/TransformGizmo2D.tsx",
  );

const gizmoCssPath =
  path.join(
    root,
    "src/components/reconstruction/transformGizmo2D.css",
  );

const payloadGizmo =
  path.join(
    scriptDir,
    "TransformGizmo2D.tsx",
  );

const payloadCss =
  path.join(
    scriptDir,
    "transformGizmo2D.css",
  );

const backupRoot =
  path.join(
    root,
    ".roadsafe-ui-backup",
  );

const statePath =
  path.join(
    backupRoot,
    "last-gizmo-only-v2.json",
  );

const buildLogPath =
  path.join(
    backupRoot,
    "gizmo-only-v2-build.log",
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

function normalizeEol(
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

function sourceEol(
  source,
) {
  return source.includes(
    "\r\n",
  )
    ? "\r\n"
    : "\n";
}

function restoreEol(
  source,
  original,
) {
  return sourceEol(
    original,
  ) ===
    "\r\n"
    ? source.replace(
        /\n/g,
        "\r\n",
      )
    : source;
}

function replaceOnce(
  source,
  before,
  after,
  label,
) {
  const index =
    source.indexOf(
      before,
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
    after +
    source.slice(
      index +
        before.length,
    )
  );
}

function lineIndentAt(
  source,
  index,
) {
  const lineStart =
    source.lastIndexOf(
      "\n",
      index,
    ) +
    1;

  return (
    source
      .slice(
        lineStart,
        index,
      )
      .match(
        /^[ \t]*/,
      )?.[0] ??
    ""
  );
}

function findSelfClosingJsxEnd(
  source,
  start,
) {
  let quote =
    null;

  let braceDepth =
    0;

  for (
    let index =
      start;
    index <
      source.length -
        1;
    index +=
      1
  ) {
    const character =
      source[
        index
      ];

    const next =
      source[
        index +
        1
      ];

    if (
      quote
    ) {
      if (
        character ===
        "\\" &&
        index +
          1 <
          source.length
      ) {
        index +=
          1;

        continue;
      }

      if (
        character ===
        quote
      ) {
        quote =
          null;
      }

      continue;
    }

    if (
      character ===
        '"' ||
      character ===
        "'" ||
      character ===
        "`"
    ) {
      quote =
        character;

      continue;
    }

    if (
      character ===
      "{"
    ) {
      braceDepth +=
        1;

      continue;
    }

    if (
      character ===
      "}"
    ) {
      braceDepth =
        Math.max(
          0,
          braceDepth -
            1,
        );

      continue;
    }

    if (
      braceDepth ===
        0 &&
      character ===
        "/" &&
      next ===
        ">"
    ) {
      return (
        index +
        2
      );
    }
  }

  return -1;
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
    typesPath,
    participant2DPath,
    sceneObjectRendererPath,
    editorPath,
    viewerPath,
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

/*
 * IMPORTANT SCOPE GUARD
 * ---------------------
 * This installer intentionally does not read or write:
 *
 * - RoadSceneEnvironment.tsx
 * - RealSceneGeometryLayer.tsx
 * - forensicScenePipelineService.ts
 * - realSceneExtractionService.ts
 * - terrain / OSM / Overpass code
 */
const forbiddenPaths = [
  "RoadSceneEnvironment.tsx",
  "RealSceneGeometryLayer.tsx",
  "forensicScenePipelineService.ts",
  "realSceneExtractionService.ts",
];

const installerSource =
  fs.readFileSync(
    fileURLToPath(
      import.meta.url,
    ),
    "utf8",
  );

for (
  const forbidden of
    forbiddenPaths
) {
  const writePattern =
    new RegExp(
      `writeFileSync\\([^\\n]*${forbidden.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      )}`,
    );

  if (
    writePattern.test(
      installerSource,
    )
  ) {
    fail(
      `Gizmo-only scope audit failed: installer writes ${forbidden}.`,
    );
  }
}

const originals = {
  types:
    fs.readFileSync(
      typesPath,
      "utf8",
    ),

  participant2D:
    fs.readFileSync(
      participant2DPath,
      "utf8",
    ),

  sceneObjectRenderer:
    fs.readFileSync(
      sceneObjectRendererPath,
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

  gizmo:
    fs.existsSync(
      gizmoPath,
    )
      ? fs.readFileSync(
          gizmoPath,
          "utf8",
        )
      : null,

  gizmoCss:
    fs.existsSync(
      gizmoCssPath,
    )
      ? fs.readFileSync(
          gizmoCssPath,
          "utf8",
        )
      : null,
};

let types =
  normalizeEol(
    originals.types,
  );

let participant2D =
  normalizeEol(
    originals.participant2D,
  );

let sceneObjectRenderer =
  normalizeEol(
    originals.sceneObjectRenderer,
  );

let editor =
  normalizeEol(
    originals.editor,
  );

let viewer =
  normalizeEol(
    originals.viewer,
  );

/* ====================================================================== */
/* 1. Participant visual/model scale only.                                */
/* ====================================================================== */

if (
  !types.includes(
    "visualScale?: number;",
  )
) {
  const assetIndex =
    types.indexOf(
      "assetId?: ReconstructionParticipantAssetId;",
    );

  if (
    assetIndex <
    0
  ) {
    fail(
      "Could not locate participant assetId property. No files changed.",
    );
  }

  const lineEnd =
    types.indexOf(
      "\n",
      assetIndex,
    );

  types =
    types.slice(
      0,
      lineEnd +
        1,
    ) +
`  /**
   * Visual/model scale controlled by the reconstruction gizmo.
   * This does NOT change participant physics dimensions or mass.
   */
  visualScale?: number;
` +
    types.slice(
      lineEnd +
        1,
    );
}

/* ====================================================================== */
/* 2. Participant2DModel consumes visualScale.                            */
/* ====================================================================== */

if (
  !participant2D.includes(
    "const visualScale =",
  )
) {
  const displayIndex =
    participant2D.indexOf(
      "const display =",
      participant2D.indexOf(
        "export default function Participant2DModel",
      ),
    );

  if (
    displayIndex <
    0
  ) {
    fail(
      "Could not locate Participant2DModel display size. No files changed.",
    );
  }

  participant2D =
    participant2D.slice(
      0,
      displayIndex,
    ) +
`  const visualScale =
    Math.max(
      0.2,
      Math.min(
        5,
        participant.visualScale ??
          1,
      ),
    );

` +
    participant2D.slice(
      0,
      0,
    ) +
    participant2D.slice(
      displayIndex,
    );
}

/*
 * The insertion above starts with its own two spaces. Guard against an
 * accidental doubled indent caused by local formatting.
 */
participant2D =
  participant2D.replace(
    "    const visualScale =\n",
    "  const visualScale =\n",
  );

if (
  !participant2D.includes(
    "transform: `scale(${visualScale})`",
  )
) {
  const filterLine =
    "    filter,\n";

  const styleStart =
    participant2D.indexOf(
      "const style: CSSProperties",
      participant2D.indexOf(
        "export default function Participant2DModel",
      ),
    );

  const filterIndex =
    participant2D.indexOf(
      filterLine,
      styleStart,
    );

  if (
    filterIndex <
    0
  ) {
    fail(
      "Could not locate Participant2DModel style filter. No files changed.",
    );
  }

  participant2D =
    participant2D.slice(
      0,
      filterIndex +
        filterLine.length,
    ) +
`    transform: \`scale(\${visualScale})\`,
    transformOrigin: "center center",
` +
    participant2D.slice(
      filterIndex +
        filterLine.length,
    );
}

if (
  !participant2D.includes(
    "scale(${participant.visualScale ?? 1})",
  )
) {
  const sceneGlyphTransform =
    "transform={`translate(${position.x} ${position.y}) rotate(${rotation})`}";

  if (
    participant2D.includes(
      sceneGlyphTransform,
    )
  ) {
    participant2D =
      participant2D.replace(
        sceneGlyphTransform,
        "transform={`translate(${position.x} ${position.y}) rotate(${rotation}) scale(${participant.visualScale ?? 1})`}",
      );
  }
}

/* ====================================================================== */
/* 3. Trace objects honour rotation + geometric scale in 2D.              */
/* ====================================================================== */

if (
  !sceneObjectRenderer.includes(
    "data-roadsafe-trace-transform",
  )
) {
  sceneObjectRenderer =
    sceneObjectRenderer.replace(
      "const width = Math.max(0.2, object.traceWidth ?? 0.75) * object.scale;",
      "const width = Math.max(0.2, object.traceWidth ?? 0.75);",
    );

  const firstVisiblePath =
`        <path
          data-scene-interactive="true"`;

  const pathIndex =
    sceneObjectRenderer.indexOf(
      firstVisiblePath,
      sceneObjectRenderer.indexOf(
        "if (isTraceableSceneObjectType",
      ),
    );

  if (
    pathIndex <
    0
  ) {
    fail(
      "Could not locate trace object SVG paths. No files changed.",
    );
  }

  const indent =
    lineIndentAt(
      sceneObjectRenderer,
      pathIndex,
    );

  sceneObjectRenderer =
    sceneObjectRenderer.slice(
      0,
      pathIndex,
    ) +
`${indent}<g
${indent}  data-roadsafe-trace-transform="true"
${indent}  transform={\`translate(\${object.position.x} \${object.position.y}) rotate(\${object.rotation}) scale(\${object.scale}) translate(\${-object.position.x} \${-object.position.y})\`}
${indent}>
` +
    sceneObjectRenderer.slice(
      pathIndex,
    );

  const svgCloseSearch =
    sceneObjectRenderer.indexOf(
      "\n      </svg>",
      pathIndex,
    );

  if (
    svgCloseSearch <
    0
  ) {
    fail(
      "Could not locate trace object SVG closing tag. No files changed.",
    );
  }

  sceneObjectRenderer =
    sceneObjectRenderer.slice(
      0,
      svgCloseSearch,
    ) +
`${indent}</g>` +
    sceneObjectRenderer.slice(
      svgCloseSearch,
    );
}

/* ====================================================================== */
/* 4. Editor imports the 2D gizmo.                                        */
/* ====================================================================== */

if (
  !editor.includes(
    'import TransformGizmo2D from "./TransformGizmo2D";',
  )
) {
  const guideImport =
    'import ReconstructionGuide from "./ReconstructionGuide";';

  if (
    !editor.includes(
      guideImport,
    )
  ) {
    fail(
      "Could not locate ReconstructionGuide import. No files changed.",
    );
  }

  editor =
    editor.replace(
      guideImport,
      `${guideImport}
import TransformGizmo2D from "./TransformGizmo2D";`,
    );
}

/* ====================================================================== */
/* 5. G/R/S are not viewport gestures anymore.                            */
/* ====================================================================== */

editor =
  editor.replace(
`      if (
        !isInteractive &&
        (event.button === 1 || activeWorkspaceTool === "Move")
      ) {`,
`      if (
        !isInteractive &&
        event.button === 1
      ) {`,
  );

const rotateBranchStart =
  editor.indexOf(
`      if (!isInteractive && activeWorkspaceTool === "Rotate") {`,
  );

const scaleBranchStart =
  editor.indexOf(
`      if (!isInteractive && activeWorkspaceTool === "Scale") {`,
  rotateBranchStart,
  );

const nextButtonGuard =
  editor.indexOf(
`      if (event.button !== 0) return;`,
  scaleBranchStart,
  );

if (
  rotateBranchStart >=
    0 &&
  scaleBranchStart >=
    0 &&
  nextButtonGuard >=
    0
) {
  editor =
    editor.slice(
      0,
      rotateBranchStart,
    ) +
`      /*
       * G / R / S are entity transform modes.
       * Empty viewport drags no longer pan/rotate/zoom the camera.
       * Middle mouse and map controls remain navigation controls.
       */
` +
    editor.slice(
      nextButtonGuard,
    );
}

if (
  editor.includes(
    'activeWorkspaceTool === "Move"\n        ? "reconstruction-workspace__2d-viewport--pan"',
  )
) {
  const cursorStart =
    editor.indexOf(
      "  const sceneCursorClass =",
    );

  const cursorEnd =
    editor.indexOf(
      "\n\n  const resetPlacementTools",
      cursorStart,
    );

  if (
    cursorStart >=
      0 &&
    cursorEnd >=
      0
  ) {
    const oldBlock =
      editor.slice(
        cursorStart,
        cursorEnd,
      );

    const conditionsStart =
      oldBlock.indexOf(
        "pendingParticipantPlacement",
      );

    if (
      conditionsStart >=
      0
    ) {
      editor =
        editor.slice(
          0,
          cursorStart,
        ) +
`  const sceneCursorClass =
    pendingParticipantPlacement ||
    activeSceneObjectType ||
    traceToolObjectId ||
    collisionPlacementActive ||
    measurementToolActive ||
    activeEvidencePlacementId
      ? "cursor-crosshair"
      : "";
` +
        editor.slice(
          cursorEnd,
        );
    }
  }
}

/* ====================================================================== */
/* 6. Mark the actual 2D scene plane and render gizmo inside it.           */
/* ====================================================================== */

const roadEnvironmentIndex =
  editor.indexOf(
    "<RoadSceneEnvironment",
  );

if (
  roadEnvironmentIndex <
  0
) {
  fail(
    "Could not locate RoadSceneEnvironment in the 2D scene. No files changed.",
  );
}

if (
  !editor.includes(
    'data-roadsafe-gizmo-plane="true"',
  )
) {
  const planeOpen =
    editor.lastIndexOf(
      "<div",
      roadEnvironmentIndex,
    );

  const planeOpenEnd =
    editor.indexOf(
      ">",
      planeOpen,
    );

  if (
    planeOpen <
      0 ||
    planeOpenEnd <
      0
  ) {
    fail(
      "Could not isolate the 2D scene plane. No files changed.",
    );
  }

  editor =
    editor.slice(
      0,
      planeOpenEnd,
    ) +
    '\n                data-roadsafe-gizmo-plane="true"' +
    editor.slice(
      planeOpenEnd,
    );
}

if (
  !editor.includes(
    "<TransformGizmo2D",
  )
) {
  const environmentEnd =
    findSelfClosingJsxEnd(
      editor,
      roadEnvironmentIndex,
    );

  if (
    environmentEnd <
    0
  ) {
    fail(
      "Could not locate RoadSceneEnvironment JSX end. No files changed.",
    );
  }

  const indent =
    lineIndentAt(
      editor,
      roadEnvironmentIndex,
    );

  const gizmo =
`
${indent}{!isPlaying &&
${indent}  (
${indent}    activeWorkspaceTool === "Move" ||
${indent}    activeWorkspaceTool === "Rotate" ||
${indent}    activeWorkspaceTool === "Scale"
${indent}  ) &&
${indent}  (() => {
${indent}    if (selectedSceneObject) {
${indent}      return (
${indent}        <TransformGizmo2D
${indent}          mode={activeWorkspaceTool}
${indent}          label={selectedSceneObject.label}
${indent}          disabled={selectedSceneObject.locked}
${indent}          value={{
${indent}            position: selectedSceneObject.position,
${indent}            rotationDegrees: selectedSceneObject.rotation,
${indent}            scale: selectedSceneObject.scale,
${indent}          }}
${indent}          onChange={(next) => {
${indent}            if (activeWorkspaceTool === "Move") {
${indent}              updateSceneObject(
${indent}                selectedSceneObject.id,
${indent}                { position: next.position },
${indent}              );
${indent}              return;
${indent}            }
${indent}
${indent}            if (activeWorkspaceTool === "Rotate") {
${indent}              updateSceneObject(
${indent}                selectedSceneObject.id,
${indent}                { rotation: next.rotationDegrees },
${indent}              );
${indent}              return;
${indent}            }
${indent}
${indent}            updateSceneObject(
${indent}              selectedSceneObject.id,
${indent}              { scale: next.scale },
${indent}            );
${indent}          }}
${indent}        />
${indent}      );
${indent}    }
${indent}
${indent}    if (
${indent}      selectedParticipant &&
${indent}      selectedParticipantState
${indent}    ) {
${indent}      const activePoint =
${indent}        selectedParticipant.pathPoints.find(
${indent}          (point) =>
${indent}            point.id ===
${indent}            selectedParticipantState.activePointId,
${indent}        );
${indent}
${indent}      const routeTransformLocked =
${indent}        !activePoint ||
${indent}        !canBeginRoutePointDrag(activePoint);
${indent}
${indent}      return (
${indent}        <TransformGizmo2D
${indent}          mode={activeWorkspaceTool}
${indent}          label={selectedParticipant.name}
${indent}          disabled={
${indent}            activeWorkspaceTool !== "Scale" &&
${indent}            routeTransformLocked
${indent}          }
${indent}          value={{
${indent}            position: selectedParticipantState.position,
${indent}            rotationDegrees: selectedParticipantState.rotation,
${indent}            scale: selectedParticipant.visualScale ?? 1,
${indent}          }}
${indent}          onChange={(next) => {
${indent}            if (activeWorkspaceTool === "Scale") {
${indent}              updateParticipant(
${indent}                selectedParticipant.id,
${indent}                { visualScale: next.scale },
${indent}              );
${indent}              return;
${indent}            }
${indent}
${indent}            if (
${indent}              !activePoint ||
${indent}              routeTransformLocked
${indent}            ) {
${indent}              return;
${indent}            }
${indent}
${indent}            updatePathPoint(
${indent}              selectedParticipant.id,
${indent}              activePoint.id,
${indent}              activeWorkspaceTool === "Move"
${indent}                ? { position: next.position }
${indent}                : { rotation: next.rotationDegrees },
${indent}            );
${indent}          }}
${indent}        />
${indent}      );
${indent}    }
${indent}
${indent}    return null;
${indent}  })()}
`;

  editor =
    editor.slice(
      0,
      environmentEnd,
    ) +
    gizmo +
    editor.slice(
      environmentEnd,
    );
}

/* ====================================================================== */
/* 7. Add scale readout to participant transform properties.              */
/* ====================================================================== */

if (
  !editor.includes(
    "<span>Model Scale</span>",
  )
) {
  const headingLabel =
`                                  <span>Heading</span>`;

  const headingIndex =
    editor.indexOf(
      headingLabel,
      editor.indexOf(
        "<summary>Transform</summary>",
      ),
    );

  if (
    headingIndex >=
    0
  ) {
    const labelStart =
      editor.lastIndexOf(
        "<label>",
        headingIndex,
      );

    const labelEnd =
      editor.indexOf(
        "</label>",
        headingIndex,
      );

    if (
      labelStart >=
        0 &&
      labelEnd >=
        0
    ) {
      const insertAt =
        labelEnd +
        "</label>".length;

      editor =
        editor.slice(
          0,
          insertAt,
        ) +
`
                                <div>
                                  <span>Model Scale</span>
                                  <strong>
                                    {(selectedParticipant.visualScale ?? 1).toFixed(2)}×
                                  </strong>
                                </div>` +
        editor.slice(
          insertAt,
        );
    }
  }
}

/* ====================================================================== */
/* 8. 3D TransformControls props + refs.                                  */
/* ====================================================================== */

if (
  !viewer.includes(
    'TransformControls } from "three/examples/jsm/controls/TransformControls.js"',
  )
) {
  const orbitImport =
    'import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";';

  if (
    !viewer.includes(
      orbitImport,
    )
  ) {
    fail(
      "Could not locate OrbitControls import. No files changed.",
    );
  }

  viewer =
    viewer.replace(
      orbitImport,
      `${orbitImport}
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";`,
    );
}

if (
  !viewer.includes(
    "selectedSceneObjectId?: string | null;",
  )
) {
  const onSelectParticipant =
    "  onSelectParticipant?: (participantId: string) => void;";

  if (
    !viewer.includes(
      onSelectParticipant,
    )
  ) {
    fail(
      "Could not locate Reconstruction3DViewer participant selection props. No files changed.",
    );
  }

  viewer =
    viewer.replace(
      onSelectParticipant,
`${onSelectParticipant}
  selectedSceneObjectId?: string | null;
  onSelectSceneObject?: (objectId: string) => void;

  onTransformParticipant?: (
    participantId: string,
    next: {
      position: ReconstructionPosition;
      rotationDegrees: number;
      visualScale: number;
    },
  ) => void;

  onTransformSceneObject?: (
    objectId: string,
    next: {
      position: ReconstructionPosition;
      rotationDegrees: number;
      scaleMultiplier: number;
    },
  ) => void;`,
    );
}

if (
  !viewer.includes(
    "selectedSceneObjectId = null",
  )
) {
  const destructure =
`  selectedParticipantId = null,
  onSelectParticipant,`;

  if (
    !viewer.includes(
      destructure,
    )
  ) {
    fail(
      "Could not locate 3D viewer participant destructure seam. No files changed.",
    );
  }

  viewer =
    viewer.replace(
      destructure,
`  selectedParticipantId = null,
  onSelectParticipant,
  selectedSceneObjectId = null,
  onSelectSceneObject,
  onTransformParticipant,
  onTransformSceneObject,`,
    );
}

if (
  !viewer.includes(
    "selectedSceneObjectRef",
  )
) {
  const selectRefs =
`  const selectedRef = useRef<string | null>(selectedParticipantId);
  const onSelectRef = useRef(onSelectParticipant);`;

  if (
    !viewer.includes(
      selectRefs,
    )
  ) {
    fail(
      "Could not locate 3D viewer selection refs. No files changed.",
    );
  }

  viewer =
    viewer.replace(
      selectRefs,
`${selectRefs}
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
    );

  const selectEffect =
`  useEffect(() => {
    onSelectRef.current = onSelectParticipant;
  }, [onSelectParticipant]);`;

  if (
    !viewer.includes(
      selectEffect,
    )
  ) {
    fail(
      "Could not locate 3D viewer selection effect. No files changed.",
    );
  }

  viewer =
    viewer.replace(
      selectEffect,
`${selectEffect}
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
    );
}

/* ====================================================================== */
/* 9. 3D G/R/S no longer remap OrbitControls.                             */
/* ====================================================================== */

const orbitToolBlock =
`    if (workspaceTool === "Move") {
      controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    } else if (workspaceTool === "Scale") {
      controls.mouseButtons.LEFT = THREE.MOUSE.DOLLY;
    } else {
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    }`;

if (
  viewer.includes(
    orbitToolBlock,
  )
) {
  viewer =
    viewer.replace(
      orbitToolBlock,
`    /*
     * G / R / S belong to the selected entity, not the camera.
     * Camera navigation keeps ordinary OrbitControls behaviour.
     */
    controls.mouseButtons.LEFT =
      THREE.MOUSE.ROTATE;`,
    );
}

/* ====================================================================== */
/* 10. Build selectable 3D participant/object entries.                    */
/* ====================================================================== */

if (
  !viewer.includes(
    "sceneObjectEntries =",
  )
) {
  const participantMap =
    "    const participantEntries = new Map<string, ParticipantRenderEntry>();";

  if (
    !viewer.includes(
      participantMap,
    )
  ) {
    fail(
      "Could not locate participantEntries map. No files changed.",
    );
  }

  viewer =
    viewer.replace(
      participantMap,
`${participantMap}
    const sceneObjectEntries =
      new Map<
        string,
        {
          object:
            ReconstructionSceneObject;
          holder:
            THREE.Group;
        }
      >();`,
    );
}

if (
  !viewer.includes(
    "participant.visualScale ?? 1",
  )
) {
  const participantCreate =
`      const entry = createParticipantHolder(participant);
      scene.add(entry.holder);`;

  if (
    !viewer.includes(
      participantCreate,
    )
  ) {
    fail(
      "Could not locate participant holder creation. No files changed.",
    );
  }

  viewer =
    viewer.replace(
      participantCreate,
`      const entry = createParticipantHolder(participant);

      entry.holder.scale.setScalar(
        Math.max(
          0.2,
          Math.min(
            5,
            participant.visualScale ??
              1,
          ),
        ),
      );

      scene.add(entry.holder);`,
    );
}

/*
 * Trace objects: create a transformable holder around the canonical centroid.
 */
const traceBlock =
`          if (object.tracePoints && object.tracePoints.length > 1) {
            const line = new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(
                object.tracePoints.map((point) =>
                  worldPosition(point, width, height, 0.12),
                ),
              ),
              new THREE.LineBasicMaterial({ color: 0x292929 }),
            );
            scene.add(line);
            settleAsset(false);
            return;
          }`;

if (
  viewer.includes(
    traceBlock,
  )
) {
  viewer =
    viewer.replace(
      traceBlock,
`          if (object.tracePoints && object.tracePoints.length > 1) {
            const holder =
              new THREE.Group();

            holder.userData.sceneObjectId =
              object.id;

            const origin =
              worldPosition(
                object.position,
                width,
                height,
                0.12,
              );

            const line =
              new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(
                  object.tracePoints.map(
                    (point) =>
                      worldPosition(
                        point,
                        width,
                        height,
                        0.12,
                      ).sub(
                        origin,
                      ),
                  ),
                ),
                new THREE.LineBasicMaterial({
                  color:
                    0x292929,
                }),
              );

            line.scale.setScalar(
              Math.max(
                0.2,
                object.scale,
              ),
            );

            holder.position.copy(
              origin,
            );

            holder.rotation.y =
              -THREE.MathUtils.degToRad(
                object.rotation,
              );

            holder.add(
              line,
            );

            holder.traverse(
              (child) => {
                child.userData.sceneObjectId =
                  object.id;
              },
            );

            scene.add(
              holder,
            );

            sceneObjectEntries.set(
              object.id,
              {
                object,
                holder,
              },
            );

            settleAsset(false);
            return;
          }`,
    );
}

if (
  !viewer.includes(
    "holder.userData.sceneObjectId",
  )
) {
  const holderCreate =
    "          const holder = new THREE.Group();";

  const objectSection =
    viewer.indexOf(
      "if (effectiveShowObjects)",
    );

  const holderIndex =
    viewer.indexOf(
      holderCreate,
      objectSection,
    );

  if (
    holderIndex <
    0
  ) {
    fail(
      "Could not locate standard 3D scene object holder. No files changed.",
    );
  }

  const insertAt =
    holderIndex +
    holderCreate.length;

  viewer =
    viewer.slice(
      0,
      insertAt,
    ) +
`
          holder.userData.sceneObjectId =
            object.id;` +
    viewer.slice(
      insertAt,
    );
}

if (
  !viewer.includes(
    "sceneObjectEntries.set(",
  ) ||
  (
    viewer.match(
      /sceneObjectEntries\.set\(/g,
    ) ??
    []
  ).length <
    2
) {
  const standardSceneAdd =
`          scene.add(holder);
          void loadRealisticSceneObjectModel(object)`;

  if (
    !viewer.includes(
      standardSceneAdd,
    )
  ) {
    fail(
      "Could not locate standard 3D scene object scene.add seam. No files changed.",
    );
  }

  viewer =
    viewer.replace(
      standardSceneAdd,
`          holder.traverse(
            (child) => {
              child.userData.sceneObjectId =
                object.id;
            },
          );

          scene.add(holder);

          sceneObjectEntries.set(
            object.id,
            {
              object,
              holder,
            },
          );

          void loadRealisticSceneObjectModel(object)`,
    );
}

/* ====================================================================== */
/* 11. Install TransformControls after all editable entries exist.         */
/* ====================================================================== */

if (
  !viewer.includes(
    "const transformControls = new TransformControls",
  )
) {
  const raycasterMarker =
    "    const raycaster = new THREE.Raycaster();";

  const raycasterIndex =
    viewer.indexOf(
      raycasterMarker,
    );

  if (
    raycasterIndex <
    0
  ) {
    fail(
      "Could not locate 3D raycaster seam. No files changed.",
    );
  }

  const transformCode =
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

    const selectedSceneObjectEntry =
      selectedSceneObjectRef.current
        ? sceneObjectEntries.get(
            selectedSceneObjectRef.current,
          )
        : undefined;

    const transformModeActive =
      workspaceTool === "Move" ||
      workspaceTool === "Rotate" ||
      workspaceTool === "Scale";

    let transformTarget:
      THREE.Object3D |
      null =
      null;

    let transformTargetKind:
      "participant" |
      "scene-object" |
      null =
      null;

    if (
      transformModeActive &&
      selectedSceneObjectEntry &&
      !selectedSceneObjectEntry.object.locked
    ) {
      transformTarget =
        selectedSceneObjectEntry.holder;

      transformTargetKind =
        "scene-object";
    } else if (
      transformModeActive &&
      selectedParticipantEntry
    ) {
      const selectedState =
        getParticipantStateAtTime(
          selectedParticipantEntry.participant,
          timeRef.current,
          {
            widthMetres:
              width,
            heightMetres:
              height,
          },
        );

      const selectedPoint =
        selectedParticipantEntry.participant.pathPoints.find(
          (point) =>
            point.id ===
            selectedState.activePointId,
        );

      const participantRouteEditable =
        workspaceTool === "Scale" ||
        Boolean(
          selectedPoint &&
          !isPhysicsGeneratedPathPoint(
            selectedPoint,
          ) &&
          selectedPoint.action !==
            "Impact",
        );

      if (
        participantRouteEditable
      ) {
        transformTarget =
          selectedParticipantEntry.holder;

        transformTargetKind =
          "participant";
      }
    }

    if (
      transformTarget
    ) {
      transformHelper.visible =
        true;

      transformControls.attach(
        transformTarget,
      );

      transformControls.setSpace(
        "world",
      );

      if (
        workspaceTool ===
        "Move"
      ) {
        transformControls.setMode(
          "translate",
        );

        transformControls.showX =
          true;

        transformControls.showY =
          false;

        transformControls.showZ =
          true;
      } else if (
        workspaceTool ===
        "Rotate"
      ) {
        transformControls.setMode(
          "rotate",
        );

        transformControls.showX =
          false;

        transformControls.showY =
          true;

        transformControls.showZ =
          false;
      } else {
        transformControls.setMode(
          "scale",
        );

        transformControls.showX =
          true;

        transformControls.showY =
          true;

        transformControls.showZ =
          true;
      }
    }

    transformControls.addEventListener(
      "dragging-changed",
      (
        event,
      ) => {
        gizmoDragging =
          Boolean(
            event.value,
          );

        controls.enabled =
          cameraModeRef.current ===
            "Orbit" &&
          !gizmoDragging;
      },
    );

    transformControls.addEventListener(
      "objectChange",
      () => {
        if (
          workspaceTool !==
            "Scale" ||
          !transformTarget
        ) {
          return;
        }

        /*
         * RoadSafe scale is deliberately uniform. Three's individual axis
         * scale handles are normalized into one scalar immediately.
         */
        const activeAxis =
          transformControls.axis ??
          "XYZ";

        const scalar =
          activeAxis.includes(
            "X",
          )
            ? transformTarget.scale.x
            : activeAxis.includes(
                "Y",
              )
              ? transformTarget.scale.y
              : transformTarget.scale.z;

        transformTarget.scale.setScalar(
          Math.max(
            0.2,
            scalar,
          ),
        );
      },
    );

    const commitTransform =
      () => {
        if (
          !transformTarget ||
          !transformTargetKind
        ) {
          return;
        }

        const position: ReconstructionPosition = {
          x:
            clamp(
              (
                transformTarget.position.x /
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
                transformTarget.position.z /
                  height +
                0.5
              ) *
                100,
              0,
              100,
            ),
        };

        const rotationDegrees =
          (
            -THREE.MathUtils.radToDeg(
              transformTarget.rotation.y,
            ) +
            360
          ) %
          360;

        if (
          transformTargetKind ===
            "scene-object" &&
          selectedSceneObjectEntry
        ) {
          onTransformSceneObjectRef.current?.(
            selectedSceneObjectEntry.object.id,
            {
              position,
              rotationDegrees,

              /*
               * Scene-object dimensions already consume object.scale.
               * TransformControls therefore contributes a multiplier.
               */
              scaleMultiplier:
                Math.max(
                  0.2,
                  transformTarget.scale.x,
                ),
            },
          );

          return;
        }

        if (
          transformTargetKind ===
            "participant" &&
          selectedParticipantEntry
        ) {
          onTransformParticipantRef.current?.(
            selectedParticipantEntry.participant.id,
            {
              position,
              rotationDegrees,
              visualScale:
                Math.max(
                  0.2,
                  transformTarget.scale.x,
                ),
            },
          );
        }
      };

    transformControls.addEventListener(
      "mouseUp",
      commitTransform,
    );

`;

  viewer =
    viewer.slice(
      0,
      raycasterIndex,
    ) +
    transformCode +
    viewer.slice(
      raycasterIndex,
    );
}

/* ====================================================================== */
/* 12. 3D pointer picking includes scene objects.                          */
/* ====================================================================== */

const oldPointerSelection =
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
  viewer.includes(
    oldPointerSelection,
  )
) {
  viewer =
    viewer.replace(
      oldPointerSelection,
`      const hit = raycaster
        .intersectObjects(
          [
            ...Array.from(
              participantEntries.values(),
            ).map(
              (entry) => entry.holder,
            ),
            ...Array.from(
              sceneObjectEntries.values(),
            ).map(
              (entry) => entry.holder,
            ),
          ],
          true,
        )
        .find((intersection) => {
          let current:
            THREE.Object3D |
            null =
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
        THREE.Object3D |
        null =
        hit.object;

      while (
        current &&
        !current.userData.participantId &&
        !current.userData.sceneObjectId
      ) {
        current =
          current.parent;
      }

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

      const participantId =
        current?.userData.participantId as
          | string
          | undefined;

      if (
        participantId
      ) {
        onSelectRef.current?.(
          participantId,
        );
      }`,
    );
}

/* ====================================================================== */
/* 13. Don't fight the gizmo from the participant playback loop.          */
/* ====================================================================== */

if (
  !viewer.includes(
    "gizmoDragging &&",
  )
) {
  const animationLoop =
`      participantEntries.forEach((entry) => {
        const state = getParticipantStateAtTime(`;

  if (
    !viewer.includes(
      animationLoop,
    )
  ) {
    fail(
      "Could not locate participant animation loop. No files changed.",
    );
  }

  viewer =
    viewer.replace(
      animationLoop,
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

viewer =
  viewer.replace(
    '      controls.enabled = mode === "Orbit";',
    '      controls.enabled = mode === "Orbit" && !gizmoDragging;',
  );

/* ====================================================================== */
/* 14. TransformControls cleanup + effect dependencies.                   */
/* ====================================================================== */

if (
  !viewer.includes(
    "transformControls.dispose();",
  )
) {
  const controlsDispose =
    "      controls.dispose();";

  if (
    !viewer.includes(
      controlsDispose,
    )
  ) {
    fail(
      "Could not locate OrbitControls cleanup. No files changed.",
    );
  }

  viewer =
    viewer.replace(
      controlsDispose,
`      transformControls.detach();
      transformControls.dispose();
      scene.remove(transformHelper);
${controlsDispose}`,
    );
}

const dependencyTail =
`    reconstruction,
    workspaceMode,
    workspaceTimeSourceRef,
    workspaceTool,
  ]);`;

if (
  viewer.includes(
    dependencyTail,
  ) &&
  !viewer.includes(
    "    selectedSceneObjectId,\n    selectedParticipantId,\n    workspaceMode,",
  )
) {
  viewer =
    viewer.replace(
      dependencyTail,
`    reconstruction,
    selectedSceneObjectId,
    selectedParticipantId,
    workspaceMode,
    workspaceTimeSourceRef,
    workspaceTool,
  ]);`,
    );
}

/* ====================================================================== */
/* 15. Parent passes selection + canonical transform callbacks.            */
/* ====================================================================== */

if (
  !editor.includes(
    "onTransformParticipant={(participantId, next)",
  )
) {
  const propsSeam =
`                  onSelectParticipant={(participantId) =>
                    handleSelectParticipant(participantId)
                  }`;

  if (
    !editor.includes(
      propsSeam,
    )
  ) {
    fail(
      "Could not locate Reconstruction3DViewer selection props. No files changed.",
    );
  }

  editor =
    editor.replace(
      propsSeam,
`${propsSeam}
                  selectedSceneObjectId={selectedSceneObjectId}
                  onSelectSceneObject={(objectId) =>
                    handleSelectSceneObject(objectId)
                  }
                  onTransformSceneObject={(objectId, next) => {
                    setIsPlaying(false);

                    const object =
                      reconstruction.sceneObjects.find(
                        (item) =>
                          item.id ===
                          objectId,
                      );

                    if (!object) {
                      return;
                    }

                    if (activeWorkspaceTool === "Move") {
                      updateSceneObject(
                        objectId,
                        {
                          position:
                            next.position,
                        },
                      );

                      return;
                    }

                    if (activeWorkspaceTool === "Rotate") {
                      updateSceneObject(
                        objectId,
                        {
                          rotation:
                            next.rotationDegrees,
                        },
                      );

                      return;
                    }

                    if (activeWorkspaceTool === "Scale") {
                      updateSceneObject(
                        objectId,
                        {
                          scale:
                            clamp(
                              object.scale *
                                next.scaleMultiplier,
                              0.2,
                              5,
                            ),
                        },
                      );
                    }
                  }}
                  onTransformParticipant={(participantId, next) => {
                    setIsPlaying(false);

                    const participant =
                      reconstruction.vehicles.find(
                        (item) =>
                          item.id ===
                          participantId,
                      );

                    if (!participant) {
                      return;
                    }

                    if (activeWorkspaceTool === "Scale") {
                      updateParticipant(
                        participantId,
                        {
                          visualScale:
                            clamp(
                              next.visualScale,
                              0.2,
                              5,
                            ),
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

                    const activePoint =
                      participant.pathPoints.find(
                        (point) =>
                          point.id ===
                          state.activePointId,
                      );

                    if (
                      !activePoint ||
                      !canBeginRoutePointDrag(
                        activePoint,
                      )
                    ) {
                      showSaveMessage(
                        "Point Z and physics-generated points cannot be transformed independently.",
                        "info",
                        3000,
                      );

                      return;
                    }

                    updatePathPoint(
                      participantId,
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
                  }}`,
    );
}

/* ====================================================================== */
/* 16. Verification BEFORE write.                                         */
/* ====================================================================== */

for (
  const [
    label,
    source,
    tokens,
  ] of [
    [
      "types",
      types,
      [
        "visualScale?: number;",
      ],
    ],
    [
      "Participant2DModel",
      participant2D,
      [
        "const visualScale =",
        "participant.visualScale",
      ],
    ],
    [
      "SceneObjectRenderer",
      sceneObjectRenderer,
      [
        "data-roadsafe-trace-transform",
        "rotate(${object.rotation})",
        "scale(${object.scale})",
      ],
    ],
    [
      "editor",
      editor,
      [
        'import TransformGizmo2D from "./TransformGizmo2D";',
        'data-roadsafe-gizmo-plane="true"',
        "<TransformGizmo2D",
        "selectedParticipant.visualScale",
        "onTransformParticipant",
        "onTransformSceneObject",
      ],
    ],
    [
      "3D viewer",
      viewer,
      [
        "TransformControls",
        "selectedSceneObjectId",
        "sceneObjectEntries",
        "transformControls.attach",
        "scaleMultiplier",
        "visualScale",
        "gizmoDragging",
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
  viewer.includes(
    'controls.mouseButtons.LEFT = THREE.MOUSE.PAN',
  ) ||
  viewer.includes(
    'controls.mouseButtons.LEFT = THREE.MOUSE.DOLLY',
  )
) {
  fail(
    "3D G/R/S camera remapping survived the gizmo patch. No files changed.",
  );
}

if (
  editor.includes(
    '(event.button === 1 || activeWorkspaceTool === "Move")',
  )
) {
  fail(
    "2D Move viewport-pan shortcut survived the gizmo patch. No files changed.",
  );
}

const gizmo =
  fs.readFileSync(
    payloadGizmo,
    "utf8",
  );

const gizmoCss =
  fs.readFileSync(
    payloadCss,
    "utf8",
  );

/*
 * TypeScript compatibility guard:
 * Map.prototype.values() is a MapIterator and cannot be mapped directly.
 */
const invalidParticipantIteratorMap =
  "participantEntries.values()" +
  ".map(";

const invalidSceneObjectIteratorMap =
  "sceneObjectEntries.values()" +
  ".map(";

if (
  viewer.includes(
    invalidParticipantIteratorMap,
  ) ||
  viewer.includes(
    invalidSceneObjectIteratorMap,
  )
) {
  fail(
    "MapIterator regression audit failed. No files changed.",
  );
}

if (
  !viewer.includes(
    "Array.from(\n              participantEntries.values(),"
  ) ||
  !viewer.includes(
    "Array.from(\n              sceneObjectEntries.values(),"
  )
) {
  fail(
    "3D picker iterator materialization audit failed. No files changed.",
  );
}

console.log(
  "3D picker MapIterator compatibility audit: PASS",
);

/* ====================================================================== */
/* 17. Parse all changed/new TS/TSX before write.                          */
/* ====================================================================== */

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
      types,
      ts.ScriptKind.TS,
    ],
    [
      "Participant2DModel.tsx",
      participant2D,
      ts.ScriptKind.TSX,
    ],
    [
      "SceneObjectRenderer.tsx",
      sceneObjectRenderer,
      ts.ScriptKind.TSX,
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
      "TransformGizmo2D.tsx",
      gizmo,
      ts.ScriptKind.TSX,
    ],
  ];

  for (
    const [
      name,
      source,
      kind,
    ] of targets
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
            30,
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
                file
                  .getLineAndCharacterOfPosition(
                    diagnostic.start,
                  );

              return `${name}:${position.line + 1}:${position.character + 1} ${message}`;
            },
          )
          .join(
            "\n",
          );

      fail(
        `Gizmo-only TS/TSX parse audit failed:\n${details}`,
      );
    }
  }

  console.log(
    "Gizmo-only TS/TSX parse audit: PASS",
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
    gizmoCss
) {
  if (
    character ===
      "{"
  ) {
    cssDepth +=
      1;
  } else if (
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
      "Transform gizmo CSS brace audit failed. No files changed.",
    );
  }
}

if (
  cssDepth !==
  0
) {
  fail(
    "Transform gizmo CSS brace audit failed. No files changed.",
  );
}

/* ====================================================================== */
/* 18. Backup.                                                             */
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
    typesPath,
    originals.types,
    "utf8",
  );

  fs.writeFileSync(
    participant2DPath,
    originals.participant2D,
    "utf8",
  );

  fs.writeFileSync(
    sceneObjectRendererPath,
    originals.sceneObjectRenderer,
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

  restoreOptional(
    gizmoPath,
    originals.gizmo,
  );

  restoreOptional(
    gizmoCssPath,
    originals.gizmoCss,
  );

  fs.rmSync(
    statePath,
    {
      force:
        true,
    },
  );
}

/* ====================================================================== */
/* 19. Write ONLY gizmo-related files.                                     */
/* ====================================================================== */

fs.writeFileSync(
  typesPath,
  restoreEol(
    types,
    originals.types,
  ),
  "utf8",
);

fs.writeFileSync(
  participant2DPath,
  restoreEol(
    participant2D,
    originals.participant2D,
  ),
  "utf8",
);

fs.writeFileSync(
  sceneObjectRendererPath,
  restoreEol(
    sceneObjectRenderer,
    originals.sceneObjectRenderer,
  ),
  "utf8",
);

fs.writeFileSync(
  editorPath,
  restoreEol(
    editor,
    originals.editor,
  ),
  "utf8",
);

fs.writeFileSync(
  viewerPath,
  restoreEol(
    viewer,
    originals.viewer,
  ),
  "utf8",
);

fs.writeFileSync(
  gizmoPath,
  gizmo,
  "utf8",
);

fs.writeFileSync(
  gizmoCssPath,
  gizmoCss,
  "utf8",
);

console.log(
  "PATCHED gizmo-only reconstruction transforms.",
);

console.log(
  "No extraction / OSM / terrain files were changed.",
);

/* ====================================================================== */
/* 20. Full project build.                                                 */
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
    "RoadSafe Gizmo Only V2",
    "======================",
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
    "Build failed. Restoring the pre-gizmo files...",
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
  "RoadSafe Gizmo Only V2 installed successfully.",
);

console.log("");
console.log(
  "G = Move selected participant/object",
);

console.log(
  "R = Rotate selected participant/object",
);

console.log(
  "S = Scale selected participant/object",
);

console.log("");
console.log(
  "2D viewport navigation:",
);

console.log(
  "  middle mouse / map controls",
);

console.log("");
console.log(
  "3D viewport navigation:",
);

console.log(
  "  normal OrbitControls when the gizmo is not being dragged",
);

console.log("");
console.log(
  "Participant scale is visual only; physics dimensions and mass are untouched.",
);

console.log("");
console.log(
  "Rollback:",
);

console.log(
  "  node revoke-gizmo-only-v2.mjs",
);
