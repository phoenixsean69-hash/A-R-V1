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
  "[RoadSafe:EasyViewportMouseNavigationV1:2D]";

const MARKER_3D =
  "[RoadSafe:EasyViewportMouseNavigationV1:3D]";

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

/* -------------------------------------------------------------------------- */
/* 2D viewport navigation                                                     */
/* -------------------------------------------------------------------------- */

if (!editor.includes(MARKER_2D)) {
  const buttonGuard =
`      if (!sceneRef.current || (event.button !== 0 && event.button !== 1)) return;`;

  const buttonGuardReplacement =
`      /*
       * ${MARKER_2D}
       *
       * Navigation:
       * - middle drag = pan
       * - right drag = pan
       * - Shift + left drag on empty scene = pan
       * - ordinary left-click editing remains unchanged
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
      }`;

  if (!editor.includes(buttonGuard)) {
    fail(
      "Could not locate the 2D scene mouse-button guard. No files were changed.",
    );
  }

  editor =
    editor.replace(
      buttonGuard,
      buttonGuardReplacement,
    );

  const panCondition =
`      if (
        !isInteractive &&
        event.button === 1
      ) {`;

  const panConditionReplacement =
`      const wantsViewportPan =
        event.button === 1 ||
        event.button === 2 ||
        (
          event.button === 0 &&
          event.shiftKey &&
          !isInteractive
        );

      if (
        wantsViewportPan
      ) {`;

  if (!editor.includes(panCondition)) {
    fail(
      "Could not locate the existing 2D pan condition. No files were changed.",
    );
  }

  editor =
    editor.replace(
      panCondition,
      panConditionReplacement,
    );

  const pointerCancelAnchor =
`              onPointerCancel={handleSceneGesturePointerEnd}`;

  const contextMenuLine =
`              onContextMenu={(event) => event.preventDefault()}`;

  if (
    editor.includes(pointerCancelAnchor) &&
    !editor.includes(contextMenuLine)
  ) {
    editor =
      editor.replace(
        pointerCancelAnchor,
`${pointerCancelAnchor}
${contextMenuLine}`,
      );
  }

  /*
   * Update the built-in help text so the UI itself explains the new controls.
   * These replacements are intentionally optional; navigation installation
   * does not depend on wording.
   */
  editor =
    editor.replace(
      'twoD: "Drag empty map space to pan. Drag editable route points and scene handles to reposition them.",',
      'twoD: "Middle/right-drag to pan anywhere. Shift + left-drag empty space also pans. Drag editable handles normally to reposition them.",',
    );

  editor =
    editor.replace(
      'threeD: "Click a participant to select it; drag the scene normally to orbit.",',
      'threeD: "Left-drag to orbit. Middle/right-drag to pan. Use the wheel to zoom.",',
    );

  editor =
    editor.replace(
      'threeD: "Drag the 3D scene to pan the camera target.",',
      'threeD: "Middle/right-drag pans the camera. Left-drag keeps orbiting around the scene.",',
    );
}

/* -------------------------------------------------------------------------- */
/* 3D viewport navigation                                                     */
/* -------------------------------------------------------------------------- */

if (!viewer.includes(MARKER_3D)) {
  const controlsAnchor =
`    controls.mouseButtons.LEFT =
      THREE.MOUSE.ROTATE;`;

  const controlsReplacement =
`    /*
     * ${MARKER_3D}
     *
     * Fast desktop navigation:
     * - left drag   = orbit
     * - middle drag = pan
     * - right drag  = pan
     * - wheel       = zoom/dolly
     *
     * TransformControls still disables OrbitControls while an object gizmo
     * is being dragged, so camera movement cannot fight object transforms.
     */
    controls.enablePan = true;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.screenSpacePanning = true;
    controls.panSpeed = 1.15;
    controls.rotateSpeed = 0.82;
    controls.zoomSpeed = 1.05;

    controls.mouseButtons.LEFT =
      THREE.MOUSE.ROTATE;

    controls.mouseButtons.MIDDLE =
      THREE.MOUSE.PAN;

    controls.mouseButtons.RIGHT =
      THREE.MOUSE.PAN;`;

  if (!viewer.includes(controlsAnchor)) {
    fail(
      "Could not locate the 3D OrbitControls mouse mapping. No files were changed.",
    );
  }

  viewer =
    viewer.replace(
      controlsAnchor,
      controlsReplacement,
    );

  const pointerListenerAnchor =
`    renderer.domElement.addEventListener("pointerdown", handlePointerDown);`;

  const contextHandler =
`    const handleViewportContextMenu =
      (
        event: MouseEvent,
      ) => {
        event.preventDefault();
      };

    renderer.domElement.addEventListener(
      "contextmenu",
      handleViewportContextMenu,
    );

${pointerListenerAnchor}`;

  if (!viewer.includes(pointerListenerAnchor)) {
    fail(
      "Could not locate the 3D pointer listener anchor. No files were changed.",
    );
  }

  viewer =
    viewer.replace(
      pointerListenerAnchor,
      contextHandler,
    );

  const cleanupAnchor =
`      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);`;

  const cleanupReplacement =
`${cleanupAnchor}
      renderer.domElement.removeEventListener(
        "contextmenu",
        handleViewportContextMenu,
      );`;

  if (!viewer.includes(cleanupAnchor)) {
    fail(
      "Could not locate the 3D pointer cleanup anchor. No files were changed.",
    );
  }

  viewer =
    viewer.replace(
      cleanupAnchor,
      cleanupReplacement,
    );
}

/* -------------------------------------------------------------------------- */
/* Backup + write                                                             */
/* -------------------------------------------------------------------------- */

if (
  editor === originalEditor &&
  viewer === originalViewer
) {
  console.log("");
  console.log(
    "[RoadSafe] Easy Viewport Mouse Navigation V1 is already installed.",
  );
  console.log(
    "[RoadSafe] No files needed changing.",
  );
  console.log("");
  console.log(
    "Controls:",
  );
  console.log(
    "  2D: middle/right drag = pan, Shift+left drag empty = pan, wheel = zoom",
  );
  console.log(
    "  3D: left drag = orbit, middle/right drag = pan, wheel = zoom",
  );
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
    `easy-viewport-mouse-navigation-v1-${stamp}`,
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
  "RoadSafe Easy Viewport Mouse Navigation V1",
);
console.log(
  "==========================================",
);
console.log(
  "[OK] 2D middle-mouse drag pans from anywhere.",
);
console.log(
  "[OK] 2D right-mouse drag pans from anywhere.",
);
console.log(
  "[OK] 2D Shift + left-drag on empty space pans.",
);
console.log(
  "[OK] 2D mouse wheel zoom remains intact.",
);
console.log(
  "[OK] 3D left-drag orbits.",
);
console.log(
  "[OK] 3D middle-mouse drag pans.",
);
console.log(
  "[OK] 3D right-mouse drag pans.",
);
console.log(
  "[OK] 3D mouse wheel zoom remains intact.",
);
console.log(
  "[OK] Right-click browser context menus disabled inside both viewports.",
);
console.log(
  "[OK] Transform gizmos still take control while objects are being transformed.",
);
console.log(
  "[OK] No physics, route, scene geometry or reconstruction-state logic changed.",
);
console.log(
  `[OK] Backup: ${backupDir}`,
);

/* -------------------------------------------------------------------------- */
/* Build verification                                                         */
/* -------------------------------------------------------------------------- */

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

if (
  result.error
) {
  console.error("");
  console.error(
    `[RoadSafe] Could not launch npm build: ${result.error.message}`,
  );
  console.error(
    `[RoadSafe] Navigation patch is installed. Backup: ${backupDir}`,
  );
  process.exit(2);
}

if (
  result.status !== 0
) {
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
