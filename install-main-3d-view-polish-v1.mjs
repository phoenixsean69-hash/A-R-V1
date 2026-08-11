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
    "last-main-3d-view-polish-v1.json",
  );

const buildLogPath =
  path.join(
    backupRoot,
    "main-3d-view-polish-v1-build.log",
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
  normalizeEol(
    original,
  );

/* ====================================================================== */
/* 1. Helper functions: floor grid + fixed viewport gizmo.                */
/* ====================================================================== */

if (
  !viewer.includes(
    "function createRoadSafeViewportGrid(",
  )
) {
  const insertionMarker =
    "function makeTextSprite(";

  const insertionIndex =
    viewer.indexOf(
      insertionMarker,
    );

  if (
    insertionIndex <
    0
  ) {
    fail(
      "Could not locate makeTextSprite() seam. No files changed.",
    );
  }

  const helpers =
`function createRoadSafeViewportGrid(
  widthMetres: number,
  heightMetres: number,
): THREE.Group {
  const group =
    new THREE.Group();

  group.name =
    "RoadSafeViewportGrid";

  const largestDimension =
    Math.max(
      widthMetres,
      heightMetres,
      30,
    );

  const gridSize =
    Math.ceil(
      (
        largestDimension *
        1.55
      ) /
      10,
    ) *
    10;

  /*
   * Approximately 2 metre cells, bounded so huge extracted scenes do not
   * create hundreds of lines.
   */
  const divisions =
    Math.max(
      20,
      Math.min(
        90,
        Math.round(
          gridSize /
          2,
        ),
      ),
    );

  const grid =
    new THREE.GridHelper(
      gridSize,
      divisions,
      0x666666,
      0x3c3c3c,
    );

  grid.name =
    "RoadSafeViewportGridLines";

  grid.position.y =
    0.055;

  const gridMaterials =
    Array.isArray(
      grid.material,
    )
      ? grid.material
      : [
          grid.material,
        ];

  gridMaterials.forEach(
    (
      material,
    ) => {
      material.transparent =
        true;

      material.opacity =
        0.48;

      material.depthWrite =
        false;
    },
  );

  group.add(
    grid,
  );

  /*
   * Blender-like world axes on the floor:
   * X = red, Z = green in our X/Z ground plane.
   */
  const half =
    gridSize /
    2;

  const makeAxis =
    (
      first:
        THREE.Vector3,
      second:
        THREE.Vector3,
      colour:
        number,
      name:
        string,
    ) => {
      const geometry =
        new THREE.BufferGeometry()
          .setFromPoints([
            first,
            second,
          ]);

      const material =
        new THREE.LineBasicMaterial({
          color:
            colour,

          transparent:
            true,

          opacity:
            0.82,

          depthWrite:
            false,
        });

      const line =
        new THREE.Line(
          geometry,
          material,
        );

      line.name =
        name;

      return line;
    };

  group.add(
    makeAxis(
      new THREE.Vector3(
        -half,
        0.061,
        0,
      ),
      new THREE.Vector3(
        half,
        0.061,
        0,
      ),
      0xc94d4d,
      "RoadSafeWorldAxisX",
    ),

    makeAxis(
      new THREE.Vector3(
        0,
        0.062,
        -half,
      ),
      new THREE.Vector3(
        0,
        0.062,
        half,
      ),
      0x74a94f,
      "RoadSafeWorldAxisZ",
    ),
  );

  return group;
}

interface RoadSafeViewportGizmo {
  scene:
    THREE.Scene;

  camera:
    THREE.PerspectiveCamera;

  root:
    THREE.Group;
}

function createRoadSafeViewportGizmo():
  RoadSafeViewportGizmo {
  const scene =
    new THREE.Scene();

  const camera =
    new THREE.PerspectiveCamera(
      34,
      1,
      0.1,
      50,
    );

  camera.position.set(
    0,
    0,
    8.2,
  );

  camera.lookAt(
    0,
    0,
    0,
  );

  const root =
    new THREE.Group();

  root.name =
    "RoadSafeViewportGizmo";

  scene.add(
    root,
  );

  const makeArrow =
    (
      direction:
        THREE.Vector3,
      colour:
        number,
    ) => {
      const arrow =
        new THREE.ArrowHelper(
          direction
            .clone()
            .normalize(),
          new THREE.Vector3(
            0,
            0,
            0,
          ),
          2.55,
          colour,
          0.58,
          0.34,
        );

      arrow.line.material.transparent =
        true;

      arrow.line.material.opacity =
        0.96;

      arrow.cone.material.transparent =
        true;

      arrow.cone.material.opacity =
        0.98;

      return arrow;
    };

  root.add(
    makeArrow(
      new THREE.Vector3(
        1,
        0,
        0,
      ),
      0xd24d4d,
    ),

    makeArrow(
      new THREE.Vector3(
        0,
        1,
        0,
      ),
      0x77ad4f,
    ),

    makeArrow(
      new THREE.Vector3(
        0,
        0,
        1,
      ),
      0x4b83d1,
    ),
  );

  const ringRadius =
    2.05;

  const ringTube =
    0.055;

  const makeRing =
    (
      colour:
        number,
      rotation:
        THREE.Euler,
    ) => {
      const ring =
        new THREE.Mesh(
          new THREE.TorusGeometry(
            ringRadius,
            ringTube,
            8,
            64,
          ),
          new THREE.MeshBasicMaterial({
            color:
              colour,

            transparent:
              true,

            opacity:
              0.78,

            depthTest:
              false,
          }),
        );

      ring.rotation.copy(
        rotation,
      );

      return ring;
    };

  /*
   * TorusGeometry starts in XY with normal +Z.
   * Rotate the rings so each represents rotation around one world axis.
   */
  root.add(
    makeRing(
      0xd24d4d,
      new THREE.Euler(
        0,
        Math.PI /
          2,
        0,
      ),
    ),

    makeRing(
      0x77ad4f,
      new THREE.Euler(
        Math.PI /
          2,
        0,
        0,
      ),
    ),

    makeRing(
      0x4b83d1,
      new THREE.Euler(
        0,
        0,
        0,
      ),
    ),
  );

  const centre =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.14,
        16,
        12,
      ),
      new THREE.MeshBasicMaterial({
        color:
          0xe8872d,
      }),
    );

  centre.renderOrder =
    5;

  root.add(
    centre,
  );

  return {
    scene,
    camera,
    root,
  };
}

function disposeRoadSafeViewportGizmo(
  gizmo:
    RoadSafeViewportGizmo,
): void {
  gizmo.scene.traverse(
    (
      object,
    ) => {
      if (
        object instanceof
        THREE.Mesh
      ) {
        object.geometry.dispose();

        const materials =
          Array.isArray(
            object.material,
          )
            ? object.material
            : [
                object.material,
              ];

        materials.forEach(
          (
            material,
          ) =>
            material.dispose(),
        );
      }

      if (
        object instanceof
        THREE.Line
      ) {
        object.geometry.dispose();

        if (
          Array.isArray(
            object.material,
          )
        ) {
          object.material.forEach(
            (
              material,
            ) =>
              material.dispose(),
          );
        } else {
          object.material.dispose();
        }
      }
    },
  );
}

`;

  viewer =
    viewer.slice(
      0,
      insertionIndex,
    ) +
    helpers +
    viewer.slice(
      insertionIndex,
    );
}

/* ====================================================================== */
/* 2. Instantiate the mini viewport gizmo next to the primary renderer.   */
/* ====================================================================== */

if (
  !viewer.includes(
    "const viewportGizmo =",
  )
) {
  const rendererMarker =
    "    renderer.shadowMap.type = THREE.PCFSoftShadowMap;";

  const rendererIndex =
    viewer.indexOf(
      rendererMarker,
    );

  if (
    rendererIndex <
    0
  ) {
    fail(
      "Could not locate renderer setup seam. No files changed.",
    );
  }

  const insertAt =
    rendererIndex +
    rendererMarker.length;

  viewer =
    viewer.slice(
      0,
      insertAt,
    ) +
`
    const viewportGizmo =
      createRoadSafeViewportGizmo();
` +
    viewer.slice(
      insertAt,
    );
}

/* ====================================================================== */
/* 3. Add the actual floor grid after roads/real geometry are created.     */
/* ====================================================================== */

if (
  !viewer.includes(
    "const viewportGrid =",
  )
) {
  const participantEntriesMarker =
    "    const participantEntries = new Map<string, ParticipantRenderEntry>();";

  const participantEntriesIndex =
    viewer.indexOf(
      participantEntriesMarker,
    );

  if (
    participantEntriesIndex <
    0
  ) {
    fail(
      "Could not locate participantEntries seam after scene geometry. No files changed.",
    );
  }

  const gridCode =
`    /*
     * [RoadSafe:MainViewportGridV1]
     * A Blender-style reference grid is rendered over the scene floor.
     */
    const viewportGrid =
      createRoadSafeViewportGrid(
        width,
        height,
      );

    scene.add(
      viewportGrid,
    );

`;

  viewer =
    viewer.slice(
      0,
      participantEntriesIndex,
    ) +
    gridCode +
    viewer.slice(
      participantEntriesIndex,
    );
}

/* ====================================================================== */
/* 4. Render gizmo bottom-right in same WebGL canvas.                      */
/* ====================================================================== */

if (
  !viewer.includes(
    "[RoadSafe:BottomRightViewportGizmoV1]",
  )
) {
  const renderMarker =
    "      renderer.render(scene, camera);";

  const renderIndex =
    viewer.indexOf(
      renderMarker,
    );

  if (
    renderIndex <
    0
  ) {
    fail(
      "Could not locate primary renderer.render(scene, camera) call. No files changed.",
    );
  }

  const replacement =
`      renderer.setScissorTest(
        false,
      );

      renderer.setViewport(
        0,
        0,
        Math.max(
          1,
          renderer.domElement.clientWidth,
        ),
        Math.max(
          1,
          renderer.domElement.clientHeight,
        ),
      );

      renderer.autoClear =
        true;

      renderer.render(
        scene,
        camera,
      );

      /*
       * [RoadSafe:BottomRightViewportGizmoV1]
       *
       * Render the small orientation/transform-style gizmo using the SAME
       * WebGL renderer. No second canvas/context and almost no extra memory.
       */
      {
        const canvasWidth =
          Math.max(
            1,
            renderer.domElement.clientWidth,
          );

        const canvasHeight =
          Math.max(
            1,
            renderer.domElement.clientHeight,
          );

        const gizmoSize =
          Math.max(
            88,
            Math.min(
              122,
              Math.round(
                Math.min(
                  canvasWidth,
                  canvasHeight,
                ) *
                  0.19,
              ),
            ),
          );

        const margin =
          14;

        const gizmoX =
          Math.max(
            0,
            canvasWidth -
              gizmoSize -
              margin,
          );

        const gizmoY =
          margin;

        /*
         * World axes should appear relative to the active camera, exactly
         * like a viewport orientation widget.
         */
        viewportGizmo.root.quaternion
          .copy(
            camera.quaternion,
          )
          .invert();

        renderer.autoClear =
          false;

        renderer.clearDepth();

        renderer.setScissorTest(
          true,
        );

        renderer.setScissor(
          gizmoX,
          gizmoY,
          gizmoSize,
          gizmoSize,
        );

        renderer.setViewport(
          gizmoX,
          gizmoY,
          gizmoSize,
          gizmoSize,
        );

        renderer.render(
          viewportGizmo.scene,
          viewportGizmo.camera,
        );

        renderer.setScissorTest(
          false,
        );

        renderer.setViewport(
          0,
          0,
          canvasWidth,
          canvasHeight,
        );

        renderer.autoClear =
          true;
      }`;

  viewer =
    viewer.slice(
      0,
      renderIndex,
    ) +
    replacement +
    viewer.slice(
      renderIndex +
        renderMarker.length,
    );
}

/* ====================================================================== */
/* 5. Move the time badge so it does not cover the new bottom-right gizmo.*/
/* ====================================================================== */

viewer =
  viewer.replace(
    'className="pointer-events-none absolute bottom-3 right-3 rounded border border-[#494949] bg-[#303030] px-2.5 py-1.5 text-[9px] text-slate-300 backdrop-blur"',
    'className="pointer-events-none absolute bottom-[136px] right-3 rounded border border-[#494949] bg-[#303030] px-2.5 py-1.5 text-[9px] text-slate-300 backdrop-blur"',
  );

/* ====================================================================== */
/* 6. Dispose helper resources.                                           */
/* ====================================================================== */

if (
  !viewer.includes(
    "disposeRoadSafeViewportGizmo(",
    viewer.indexOf(
      "return () => {",
    ),
  )
) {
  const rendererDisposeMarker =
    "      renderer.dispose();";

  const disposeIndex =
    viewer.indexOf(
      rendererDisposeMarker,
    );

  if (
    disposeIndex <
    0
  ) {
    fail(
      "Could not locate renderer cleanup seam. No files changed.",
    );
  }

  viewer =
    viewer.slice(
      0,
      disposeIndex,
    ) +
`      disposeRoadSafeViewportGizmo(
        viewportGizmo,
      );

` +
    viewer.slice(
      disposeIndex,
    );
}

/* ====================================================================== */
/* 7. Verification before write.                                          */
/* ====================================================================== */

for (
  const token of [
    "function createRoadSafeViewportGrid(",
    "function createRoadSafeViewportGizmo()",
    "RoadSafeViewportGridLines",
    "[RoadSafe:MainViewportGridV1]",
    "[RoadSafe:BottomRightViewportGizmoV1]",
    "viewportGizmo.root.quaternion",
    "renderer.setScissor(",
    "bottom-[136px]",
  ]
) {
  if (
    !viewer.includes(
      token,
    )
  ) {
    fail(
      `Main 3D view verification failed: ${token}. No files changed.`,
    );
  }
}

console.log(
  "Bottom-right viewport gizmo source audit: PASS",
);

console.log(
  "Blender-style floor grid source audit: PASS",
);

/* ====================================================================== */
/* 8. Parse TSX before touching repo.                                     */
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
              file
                .getLineAndCharacterOfPosition(
                  diagnostic.start,
                );

            return `Reconstruction3DViewer.tsx:${position.line + 1}:${position.character + 1} ${message}`;
          },
        )
        .join(
          "\n",
        );

    fail(
      `Main 3D view TSX parse failed:\n${details}`,
    );
  }

  console.log(
    "Main 3D view TSX parse audit: PASS",
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

/* ====================================================================== */
/* 9. Backup + write.                                                     */
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
  "PATCHED main/mid 3D viewport only.",
);

console.log(
  "Added bottom-right camera-synchronised gizmo.",
);

console.log(
  "Added Blender-style grid floor + X/Z world axes.",
);

/* ====================================================================== */
/* 10. Full project build.                                                */
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

const output = [
  "RoadSafe Main 3D View Polish V1",
  "================================",
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
  "RoadSafe Main 3D View Polish V1 installed successfully.",
);

console.log("");
console.log(
  "3D viewport:",
);

console.log(
  "  - bottom-right RGB axis + rotation-ring gizmo",
);

console.log(
  "  - gizmo orientation follows camera",
);

console.log(
  "  - Blender-style floor grid",
);

console.log(
  "  - red X / green Z world-axis lines",
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
  "  node revoke-main-3d-view-polish-v1.mjs",
);
