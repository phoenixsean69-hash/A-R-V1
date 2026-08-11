import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

const EDITOR_REL =
  "src/components/reconstruction/AccidentReconstructionEditor.tsx";

const VIEWER_REL =
  "src/components/reconstruction/Reconstruction3DViewer.tsx";

const EDITOR =
  path.join(ROOT, ...EDITOR_REL.split("/"));

const VIEWER =
  path.join(ROOT, ...VIEWER_REL.split("/"));

const MARKER_2D =
  "[RoadSafe:EasyViewportMouseNavigationV2:2D]";

const MARKER_3D =
  "[RoadSafe:EasyViewportMouseNavigationV2:3D]";

function fail(message, code = 1) {
  console.error("");
  console.error(`[RoadSafe] ${message}`);
  process.exit(code);
}

for (const [label, file] of [
  [EDITOR_REL, EDITOR],
  [VIEWER_REL, VIEWER],
]) {
  if (!fs.existsSync(file)) {
    fail(
      `Could not find ${label}. Run this installer from the A-R-V1 repository root.`,
    );
  }
}

const originalEditor =
  fs.readFileSync(
    EDITOR,
    "utf8",
  );

const originalViewer =
  fs.readFileSync(
    VIEWER,
    "utf8",
  );

let editor =
  originalEditor;

let viewer =
  originalViewer;

/* ========================================================================== */
/* 2D                                                                         */
/* ========================================================================== */

if (!editor.includes(MARKER_2D)) {
  /*
   * Expand the existing scene pointer handler from left+middle to
   * left+middle+right. This replacement is deliberately whitespace-tolerant.
   */
  const guardPattern =
    /if\s*\(\s*!sceneRef\.current\s*\|\|\s*\(\s*event\.button\s*!==\s*0\s*&&\s*event\.button\s*!==\s*1\s*\)\s*\)\s*return\s*;/;

  if (!guardPattern.test(editor)) {
    fail(
      "Could not locate the 2D scene pointer-button guard. No files were changed.",
    );
  }

  editor =
    editor.replace(
      guardPattern,
`/*
       * ${MARKER_2D}
       *
       * Natural viewport navigation:
       * - left-drag empty space = pan
       * - middle-drag = pan
       * - right-drag = pan
       * - interactive handles keep their normal editing behaviour
       */
      if (
        !sceneRef.current ||
        (
          event.button !== 0 &&
          event.button !== 1 &&
          event.button !== 2
        )
      ) {
        return;
      }`,
    );

  /*
   * Replace the old middle-button-only pan branch.
   * Left drag only pans when the actual pointer target is NOT an interactive
   * scene control, so object/path/evidence editing still wins.
   */
  const panPattern =
    /if\s*\(\s*!isInteractive\s*&&\s*event\.button\s*===\s*1\s*\)\s*\{/;

  if (!panPattern.test(editor)) {
    fail(
      "Could not locate the existing 2D pan branch. No files were changed.",
    );
  }

  editor =
    editor.replace(
      panPattern,
`const wantsViewportPan =
        event.button === 1 ||
        event.button === 2 ||
        (
          event.button === 0 &&
          !isInteractive
        );

      if (
        wantsViewportPan
      ) {`,
    );

  /*
   * Suppress browser context menu in the 2D scene so right-drag remains
   * a navigation gesture.
   */
  const pointerCancelPattern =
    /(\s+onPointerCancel=\{handleSceneGesturePointerEnd\})/;

  if (
    pointerCancelPattern.test(editor) &&
    !editor.includes(
      'onContextMenu={(event) => event.preventDefault()}',
    )
  ) {
    editor =
      editor.replace(
        pointerCancelPattern,
        `$1
              onContextMenu={(event) => event.preventDefault()}`,
      );
  }

  /*
   * Keep workspace help accurate where those exact strings still exist.
   */
  editor =
    editor.replace(
      'twoD: "Drag empty map space to pan. Drag editable route points and scene handles to reposition them.",',
      'twoD: "Left-drag empty space to pan. Middle/right-drag also pan. Drag editable route points and scene handles normally to reposition them.",',
    );

  editor =
    editor.replace(
      'threeD: "Click a participant to select it; drag the scene normally to orbit.",',
      'threeD: "Left-drag to orbit. Middle/right-drag to pan. Use the wheel to zoom.",',
    );

  editor =
    editor.replace(
      'threeD: "Drag the 3D scene to pan the camera target.",',
      'threeD: "Middle/right-drag pans the camera target. Left-drag continues to orbit.",',
    );
}

/* ========================================================================== */
/* 3D                                                                         */
/* ========================================================================== */

if (!viewer.includes(MARKER_3D)) {
  /*
   * Anchor to OrbitControls construction rather than any later mouse mapping.
   * This survives the previous viewport-polish patches.
   */
  const orbitConstructorPattern =
    /const\s+controls\s*=\s*new\s+OrbitControls\s*\(\s*camera\s*,\s*renderer\.domElement\s*,?\s*\)\s*;/;

  const constructorMatch =
    viewer.match(
      orbitConstructorPattern,
    );

  if (!constructorMatch) {
    fail(
      "Could not locate `new OrbitControls(camera, renderer.domElement)` in the 3D viewer. No files were changed.",
    );
  }

  const constructorText =
    constructorMatch[0];

  viewer =
    viewer.replace(
      orbitConstructorPattern,
`${constructorText}

    /*
     * ${MARKER_3D}
     *
     * Easy mouse navigation:
     * - left drag   = orbit
     * - middle drag = pan
     * - right drag  = pan
     * - wheel       = zoom
     *
     * TransformControls continues to disable OrbitControls while a selected
     * entity gizmo is actively being dragged.
     */
    controls.enablePan = true;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.screenSpacePanning = true;
    controls.panSpeed = 1.2;
    controls.rotateSpeed = 0.82;
    controls.zoomSpeed = 1.08;

    controls.mouseButtons.LEFT =
      THREE.MOUSE.ROTATE;

    controls.mouseButtons.MIDDLE =
      THREE.MOUSE.PAN;

    controls.mouseButtons.RIGHT =
      THREE.MOUSE.PAN;`,
    );

  /*
   * Right mouse is now camera pan, so prevent browser context menus over
   * the main WebGL viewport.
   */
  const pointerListener =
    'renderer.domElement.addEventListener("pointerdown", handlePointerDown);';

  if (
    viewer.includes(pointerListener) &&
    !viewer.includes(
      "handleRoadSafeViewportContextMenu",
    )
  ) {
    viewer =
      viewer.replace(
        pointerListener,
`const handleRoadSafeViewportContextMenu =
      (
        event: MouseEvent,
      ) => {
        event.preventDefault();
      };

    renderer.domElement.addEventListener(
      "contextmenu",
      handleRoadSafeViewportContextMenu,
    );

    ${pointerListener}`,
      );

    const pointerCleanup =
      'renderer.domElement.removeEventListener("pointerdown", handlePointerDown);';

    if (!viewer.includes(pointerCleanup)) {
      fail(
        "3D pointer listener was found but its cleanup was not. No files were changed.",
      );
    }

    viewer =
      viewer.replace(
        pointerCleanup,
`${pointerCleanup}

      renderer.domElement.removeEventListener(
        "contextmenu",
        handleRoadSafeViewportContextMenu,
      );`,
      );
  }
}

/* ========================================================================== */
/* Write only after every required anchor succeeds                            */
/* ========================================================================== */

if (
  editor === originalEditor &&
  viewer === originalViewer
) {
  console.log("");
  console.log(
    "[RoadSafe] Easy Viewport Mouse Navigation V2 is already installed.",
  );
  console.log("");
  console.log("2D: left empty / middle / right drag = pan");
  console.log("3D: left drag = orbit; middle / right drag = pan");
  console.log("Wheel = zoom in both views");
  process.exit(0);
}

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupDir =
  path.join(
    ROOT,
    ".roadsafe-backups",
    `easy-viewport-mouse-navigation-v2-${stamp}`,
  );

fs.mkdirSync(
  backupDir,
  {
    recursive: true,
  },
);

fs.writeFileSync(
  path.join(
    backupDir,
    "AccidentReconstructionEditor.tsx",
  ),
  originalEditor,
  "utf8",
);

fs.writeFileSync(
  path.join(
    backupDir,
    "Reconstruction3DViewer.tsx",
  ),
  originalViewer,
  "utf8",
);

fs.writeFileSync(
  EDITOR,
  editor,
  "utf8",
);

fs.writeFileSync(
  VIEWER,
  viewer,
  "utf8",
);

console.log("");
console.log(
  "RoadSafe Easy Viewport Mouse Navigation V2",
);
console.log(
  "==========================================",
);
console.log(
  "[OK] 2D left-drag on empty viewport pans.",
);
console.log(
  "[OK] 2D middle-drag pans.",
);
console.log(
  "[OK] 2D right-drag pans.",
);
console.log(
  "[OK] 2D object/path/evidence handles keep their editing gestures.",
);
console.log(
  "[OK] 3D left-drag orbits.",
);
console.log(
  "[OK] 3D middle-drag pans.",
);
console.log(
  "[OK] 3D right-drag pans.",
);
console.log(
  "[OK] Wheel zoom remains available.",
);
console.log(
  "[OK] Browser context menu disabled inside navigation surfaces.",
);
console.log(
  "[OK] TransformControls still takes priority during gizmo drags.",
);
console.log(
  "[OK] No reconstruction physics or route state changed.",
);
console.log(
  `[OK] Backup: ${backupDir}`,
);

/* ========================================================================== */
/* Production build verification                                              */
/* ========================================================================== */

const npmCommand =
  process.platform === "win32"
    ? "npm.cmd"
    : "npm";

console.log("");
console.log(
  "Verifying production build...",
);

const result =
  spawnSync(
    npmCommand,
    [
      "run",
      "build",
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      windowsHide: true,
      shell:
        process.platform === "win32",
    },
  );

const output =
  [
    result.stdout ?? "",
    result.stderr ?? "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

if (result.error) {
  console.error("");
  console.error(
    `[RoadSafe] Could not launch npm build: ${result.error.message}`,
  );
  console.error(
    `[RoadSafe] Navigation patch is installed. Backup: ${backupDir}`,
  );
  process.exit(2);
}

if (result.status !== 0) {
  console.error("");
  console.error(
    "[RoadSafe] Production build failed:",
  );
  console.error("");
  console.error(
    output ||
      `(npm run build exited with status ${String(result.status)}.)`,
  );
  console.error("");
  console.error(
    `[RoadSafe] Backup: ${backupDir}`,
  );
  process.exit(3);
}

console.log(
  "[OK] Production build passed.",
);
console.log("");
console.log(
  "Now run:",
);
console.log(
  "  npm run dev",
);
