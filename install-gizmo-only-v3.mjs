import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const root =
  process.cwd();

const packagePath =
  path.join(
    root,
    "package.json",
  );

const viewerPath =
  path.join(
    root,
    "src/components/reconstruction/Reconstruction3DViewer.tsx",
  );

const backupRoot =
  path.join(
    root,
    ".roadsafe-ui-backup",
  );

const statePath =
  path.join(
    backupRoot,
    "last-gizmo-only-v3.json",
  );

const buildLogPath =
  path.join(
    backupRoot,
    "gizmo-only-v3-build.log",
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

function normaliseEol(
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

function detectEol(
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
  return detectEol(
    original,
  ) ===
    "\r\n"
    ? source.replace(
        /\n/g,
        "\r\n",
      )
    : source;
}

if (
  !fs.existsSync(
    packagePath,
  ) ||
  !fs.existsSync(
    viewerPath,
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

const original =
  fs.readFileSync(
    viewerPath,
    "utf8",
  );

let viewer =
  normaliseEol(
    original,
  );

/*
 * V3 is deliberately a tiny follow-up on top of Gizmo Only V2.
 * It touches ONLY Reconstruction3DViewer.tsx.
 */
for (
  const required of [
    'TransformControls } from "three/examples/jsm/controls/TransformControls.js"',
    "sceneObjectEntries",
    "onTransformParticipantRef",
    "onTransformSceneObjectRef",
    "const transformControls = new TransformControls",
    "const raycaster = new THREE.Raycaster();",
  ]
) {
  if (
    !viewer.includes(
      required,
    )
  ) {
    fail(
      `Gizmo Only V2 prerequisite missing: ${required}. No files changed.`,
    );
  }
}

const blockStart =
  viewer.indexOf(
    "    let gizmoDragging =",
  );

const raycasterIndex =
  viewer.indexOf(
    "    const raycaster = new THREE.Raycaster();",
    blockStart,
  );

if (
  blockStart <
    0 ||
  raycasterIndex <
    0
) {
  fail(
    "Could not isolate the V2 3D gizmo block. No files changed.",
  );
}

const combinedBlock =
`    /*
     * [RoadSafe:PersistentCompositeViewportGizmoV3]
     *
     * A selected participant or scene object always receives an in-viewport
     * Blender-style transform gizmo.
     *
     * Three TransformControls helpers are attached to the SAME target:
     *   translate -> arrows
     *   rotate    -> ring
     *   scale     -> box handles
     *
     * All helpers remain visible together. Only one controller is enabled at
     * a time, preventing event-handler conflicts.
     *
     * Select behaves like Move, so selecting a model immediately produces a
     * usable gizmo instead of an empty viewport.
     */
    let gizmoDragging =
      false;

    const translateControls =
      new TransformControls(
        camera,
        renderer.domElement,
      );

    const rotateControls =
      new TransformControls(
        camera,
        renderer.domElement,
      );

    const scaleControls =
      new TransformControls(
        camera,
        renderer.domElement,
      );

    const translateHelper =
      translateControls.getHelper();

    const rotateHelper =
      rotateControls.getHelper();

    const scaleHelper =
      scaleControls.getHelper();

    translateHelper.visible =
      false;

    rotateHelper.visible =
      false;

    scaleHelper.visible =
      false;

    scene.add(
      translateHelper,
    );

    scene.add(
      rotateHelper,
    );

    scene.add(
      scaleHelper,
    );

    translateControls.setMode(
      "translate",
    );

    /*
     * Canonical reconstruction placement is a ground-plane X/Z position.
     * Y is intentionally not authored here because participant and scene-object
     * data models do not currently store an independent vertical coordinate.
     */
    translateControls.showX =
      true;

    translateControls.showY =
      false;

    translateControls.showZ =
      true;

    translateControls.setSpace(
      "world",
    );

    rotateControls.setMode(
      "rotate",
    );

    /*
     * Participant heading / scene-object rotation are canonical yaw values.
     * Keep the Y ring interactive. The composite helper still gives the
     * selected model the unmistakable in-viewport rotation affordance.
     */
    rotateControls.showX =
      false;

    rotateControls.showY =
      true;

    rotateControls.showZ =
      false;

    rotateControls.setSpace(
      "world",
    );

    scaleControls.setMode(
      "scale",
    );

    scaleControls.showX =
      true;

    scaleControls.showY =
      true;

    scaleControls.showZ =
      true;

    scaleControls.setSpace(
      "local",
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

    let transformTarget:
      THREE.Object3D |
      null =
      null;

    let transformTargetKind:
      "participant" |
      "scene-object" |
      null =
      null;

    let participantRouteEditable =
      true;

    if (
      selectedSceneObjectEntry &&
      !selectedSceneObjectEntry.object.locked
    ) {
      transformTarget =
        selectedSceneObjectEntry.holder;

      transformTargetKind =
        "scene-object";
    } else if (
      selectedParticipantEntry
    ) {
      transformTarget =
        selectedParticipantEntry.holder;

      transformTargetKind =
        "participant";

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

      participantRouteEditable =
        Boolean(
          selectedPoint &&
          !isPhysicsGeneratedPathPoint(
            selectedPoint,
          ) &&
          selectedPoint.action !==
            "Impact",
        );
    }

    const activeCompositeMode:
      "translate" |
      "rotate" |
      "scale" =
      workspaceTool ===
        "Rotate"
        ? "rotate"
        : workspaceTool ===
            "Scale"
          ? "scale"
          : "translate";

    if (
      transformTarget
    ) {
      /*
       * Attach ALL THREE helpers. This creates the persistent combined gizmo
       * appearance requested for the viewport.
       */
      translateControls.attach(
        transformTarget,
      );

      rotateControls.attach(
        transformTarget,
      );

      scaleControls.attach(
        transformTarget,
      );

      translateHelper.visible =
        true;

      rotateHelper.visible =
        true;

      scaleHelper.visible =
        true;

      const canTranslateOrRotate =
        transformTargetKind ===
          "scene-object" ||
        participantRouteEditable;

      translateControls.enabled =
        activeCompositeMode ===
          "translate" &&
        canTranslateOrRotate;

      rotateControls.enabled =
        activeCompositeMode ===
          "rotate" &&
        canTranslateOrRotate;

      scaleControls.enabled =
        activeCompositeMode ===
        "scale";
    } else {
      translateControls.enabled =
        false;

      rotateControls.enabled =
        false;

      scaleControls.enabled =
        false;
    }

    const setGizmoDragging =
      (
        dragging:
          boolean,
      ) => {
        gizmoDragging =
          dragging;

        controls.enabled =
          cameraModeRef.current ===
            "Orbit" &&
          !gizmoDragging;
      };

    translateControls.addEventListener(
      "dragging-changed",
      (
        event,
      ) =>
        setGizmoDragging(
          Boolean(
            event.value,
          ),
        ),
    );

    rotateControls.addEventListener(
      "dragging-changed",
      (
        event,
      ) =>
        setGizmoDragging(
          Boolean(
            event.value,
          ),
        ),
    );

    scaleControls.addEventListener(
      "dragging-changed",
      (
        event,
      ) =>
        setGizmoDragging(
          Boolean(
            event.value,
          ),
        ),
    );

    scaleControls.addEventListener(
      "objectChange",
      () => {
        if (
          !transformTarget
        ) {
          return;
        }

        /*
         * RoadSafe currently stores one uniform scale scalar for participants
         * and scene objects. Normalize any grabbed scale axis back to uniform.
         */
        const axis =
          scaleControls.axis ??
          "XYZ";

        const scalar =
          axis.includes(
            "X",
          )
            ? transformTarget.scale.x
            : axis.includes(
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

    const commitCompositeTransform =
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

    translateControls.addEventListener(
      "mouseUp",
      commitCompositeTransform,
    );

    rotateControls.addEventListener(
      "mouseUp",
      commitCompositeTransform,
    );

    scaleControls.addEventListener(
      "mouseUp",
      commitCompositeTransform,
    );

`;

viewer =
  viewer.slice(
    0,
    blockStart,
  ) +
  combinedBlock +
  viewer.slice(
    raycasterIndex,
  );

/* Replace old single-control cleanup left by V2. */
const oldCleanup =
`      transformControls.detach();
      transformControls.dispose();
      scene.remove(transformHelper);
      controls.dispose();`;

if (
  !viewer.includes(
    oldCleanup,
  )
) {
  fail(
    "Could not locate the V2 TransformControls cleanup block. No files changed.",
  );
}

const newCleanup =
`      translateControls.detach();
      rotateControls.detach();
      scaleControls.detach();

      translateControls.dispose();
      rotateControls.dispose();
      scaleControls.dispose();

      scene.remove(
        translateHelper,
      );

      scene.remove(
        rotateHelper,
      );

      scene.remove(
        scaleHelper,
      );

      controls.dispose();`;

viewer =
  viewer.replace(
    oldCleanup,
    newCleanup,
  );

/* Strong regression checks. */
for (
  const token of [
    "[RoadSafe:PersistentCompositeViewportGizmoV3]",
    "const translateControls =",
    "const rotateControls =",
    "const scaleControls =",
    "translateHelper.visible =",
    "rotateHelper.visible =",
    "scaleHelper.visible =",
    'workspaceTool ===\n        "Rotate"',
    "commitCompositeTransform",
  ]
) {
  if (
    !viewer.includes(
      token,
    )
  ) {
    fail(
      `Composite gizmo verification failed: ${token}. No files changed.`,
    );
  }
}

if (
  viewer.includes(
    "const transformControls = new TransformControls"
  ) ||
  viewer.includes(
    "transformControls.detach();"
  )
) {
  fail(
    "Legacy single-mode 3D gizmo survived V3 replacement. No files changed.",
  );
}

console.log(
  "Persistent composite viewport gizmo audit: PASS",
);

/* Parse before write. */
try {
  const require =
    createRequire(
      import.meta.url,
    );

  const ts =
    require(
      "typescript",
    );

  const file =
    ts.createSourceFile(
      "Reconstruction3DViewer.tsx",
      viewer,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

  if (
    file.parseDiagnostics.length >
    0
  ) {
    const details =
      file.parseDiagnostics
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
              file.getLineAndCharacterOfPosition(
                diagnostic.start,
              );

            return `Reconstruction3DViewer.tsx:${position.line + 1}:${position.character + 1} ${message}`;
          },
        )
        .join(
          "\n",
        );

    fail(
      `Composite gizmo TSX parse failed:\n${details}`,
    );
  }

  console.log(
    "Composite gizmo TSX parse audit: PASS",
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

      original,
    },
    null,
    2,
  ),
  "utf8",
);

fs.writeFileSync(
  viewerPath,
  restoreEol(
    viewer,
    original,
  ),
  "utf8",
);

console.log(
  "PATCHED persistent combined 3D viewport gizmo.",
);

console.log(
  "No extraction / OSM / terrain files were touched.",
);

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
    "RoadSafe Gizmo Only V3",
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
  fs.writeFileSync(
    viewerPath,
    original,
    "utf8",
  );

  fs.rmSync(
    statePath,
    {
      force:
        true,
    },
  );

  console.error("");
  console.error(
    "Build failed. Reconstruction3DViewer.tsx was restored.",
  );

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
  "RoadSafe Gizmo Only V3 installed successfully.",
);

console.log("");
console.log(
  "Selected model -> combined transform gizmo is always visible in 3D.",
);

console.log(
  "Select / G -> Move arrows active",
);

console.log(
  "R -> Rotation ring active",
);

console.log(
  "S -> Scale handles active",
);

console.log("");
console.log(
  "Rollback:",
);

console.log(
  "  node revoke-gizmo-only-v3.mjs",
);
