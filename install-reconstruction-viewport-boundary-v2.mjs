import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const relativePath =
  "src/components/reconstruction/AccidentReconstructionEditor.tsx";
const editorPath = path.join(root, relativePath);

if (!fs.existsSync(packagePath) || !fs.existsSync(editorPath)) {
  console.error(
    "Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1.",
  );
  process.exit(1);
}

const packageJson = JSON.parse(
  fs.readFileSync(packagePath, "utf8"),
);

if (packageJson.name !== "roadsafe-ar") {
  console.error(
    `Expected roadsafe-ar, found "${packageJson.name ?? "unknown"}".`,
  );
  process.exit(1);
}

let source = fs.readFileSync(editorPath, "utf8");

for (const marker of [
  "sceneViewportRef",
  "const zoomSceneAtClientPoint = useCallback(",
  'title="Pan map north"',
  'title="Pan map south"',
  'title="Pan map west"',
  'title="Pan map east"',
  'title="Fit the complete map"',
  'title="Zoom map out"',
]) {
  if (!source.includes(marker)) {
    console.error(
      `Expected viewport marker not found: ${marker}`,
    );
    process.exit(1);
  }
}

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupRoot = path.join(
  root,
  ".roadsafe-ui-backup",
  timestamp,
);

const backupPath = path.join(
  backupRoot,
  relativePath,
);

fs.mkdirSync(
  path.dirname(backupPath),
  { recursive: true },
);

fs.copyFileSync(
  editorPath,
  backupPath,
);

const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-reconstruction-viewport-boundary-v2.json",
);

/*
 * True FIT.
 *
 * The scene content layer is an absolute inset-0 element inside the viewport.
 * Therefore a scale below 1.0 physically shrinks it and exposes empty canvas.
 */
if (source.includes("const MIN_SCENE_ZOOM = 0.92;")) {
  source = source.replace(
    "const MIN_SCENE_ZOOM = 0.92;",
    "const MIN_SCENE_ZOOM = 1;",
  );
} else if (!source.includes("const MIN_SCENE_ZOOM = 1;")) {
  const anchor =
    "const MAX_PLAYBACK_FRAME_DELTA_SECONDS = 0.05;";

  if (!source.includes(anchor)) {
    console.error(
      "Could not locate the reconstruction constants block.",
    );
    process.exit(1);
  }

  source = source.replace(
    anchor,
    `${anchor}
const MIN_SCENE_ZOOM = 1;
const MAX_SCENE_ZOOM = 3;
const SCENE_ZOOM_STEP = 0.1;`,
  );
}

if (!source.includes("const MAX_SCENE_ZOOM = 3;")) {
  source = source.replace(
    "const MIN_SCENE_ZOOM = 1;",
    `const MIN_SCENE_ZOOM = 1;
const MAX_SCENE_ZOOM = 3;
const SCENE_ZOOM_STEP = 0.1;`,
  );
}

/*
 * Any remaining literal 92% FIT state becomes the canonical minimum.
 */
source = source.replace(
  /zoom:\s*0\.92/g,
  "zoom: MIN_SCENE_ZOOM",
);

/*
 * Add one canonical pan clamp immediately before the existing zoom callback.
 * No dependency on showSaveMessage or any later function.
 */
if (!source.includes("const clampScenePan = useCallback(")) {
  const anchor =
    "  const zoomSceneAtClientPoint = useCallback(";

  const helper = `  const clampScenePan = useCallback(
    (
      zoom: number,
      panX: number,
      panY: number,
    ) => {
      const rectangle =
        sceneViewportRef.current?.getBoundingClientRect();

      if (!rectangle) {
        return {
          panX,
          panY,
        };
      }

      const maximumPanX = Math.max(
        0,
        ((zoom - MIN_SCENE_ZOOM) *
          rectangle.width) /
          2,
      );

      const maximumPanY = Math.max(
        0,
        ((zoom - MIN_SCENE_ZOOM) *
          rectangle.height) /
          2,
      );

      return {
        panX: clamp(
          panX,
          -maximumPanX,
          maximumPanX,
        ),
        panY: clamp(
          panY,
          -maximumPanY,
          maximumPanY,
        ),
      };
    },
    [],
  );

`;

  source = source.replace(
    anchor,
    helper + anchor,
  );
}

/*
 * Replace the complete pointer-centred zoom callback.
 * This is more robust than patching individual lines inside it.
 */
const zoomStart = source.indexOf(
  "  const zoomSceneAtClientPoint = useCallback(",
);

const zoomEnd = source.indexOf(
  "\n\n  useEffect(() =>",
  zoomStart,
);

if (zoomStart < 0 || zoomEnd < 0) {
  console.error(
    "Could not isolate the 2D pointer-centred zoom callback.",
  );
  process.exit(1);
}

const zoomCallback = `  const zoomSceneAtClientPoint = useCallback(
    (
      clientX: number,
      clientY: number,
      zoomDelta: number,
    ) => {
      const rectangle =
        sceneViewportRef.current?.getBoundingClientRect();

      if (!rectangle) return;

      setSceneView((view) => {
        const nextZoom = clamp(
          view.zoom + zoomDelta,
          MIN_SCENE_ZOOM,
          MAX_SCENE_ZOOM,
        );

        if (
          nextZoom <=
          MIN_SCENE_ZOOM + 0.0001
        ) {
          return {
            zoom: MIN_SCENE_ZOOM,
            panX: 0,
            panY: 0,
          };
        }

        if (nextZoom === view.zoom) {
          return view;
        }

        const pointerX =
          clientX -
          rectangle.left -
          rectangle.width / 2;

        const pointerY =
          clientY -
          rectangle.top -
          rectangle.height / 2;

        const contentX =
          (pointerX - view.panX) /
          view.zoom;

        const contentY =
          (pointerY - view.panY) /
          view.zoom;

        const boundedPan = clampScenePan(
          nextZoom,
          pointerX -
            contentX * nextZoom,
          pointerY -
            contentY * nextZoom,
        );

        return {
          zoom: nextZoom,
          ...boundedPan,
        };
      });
    },
    [clampScenePan],
  );`;

source =
  source.slice(0, zoomStart) +
  zoomCallback +
  source.slice(zoomEnd);

/*
 * Pointer-drag panning.
 */
const oldPanBlock = `        setSceneView((view) => ({
          ...view,
          panX: gesture.startPanX + event.clientX - gesture.startClientX,
          panY: gesture.startPanY + event.clientY - gesture.startClientY,
        }));
        return;`;

const newPanBlock = `        setSceneView((view) => {
          const boundedPan = clampScenePan(
            view.zoom,
            gesture.startPanX +
              event.clientX -
              gesture.startClientX,
            gesture.startPanY +
              event.clientY -
              gesture.startClientY,
          );

          return {
            ...view,
            ...boundedPan,
          };
        });
        return;`;

if (source.includes(oldPanBlock)) {
  source = source.replace(
    oldPanBlock,
    newPanBlock,
  );
} else if (
  !source.includes(
    "gesture.startPanX +\n              event.clientX",
  )
) {
  console.error(
    "Could not locate the 2D pointer-pan block.",
  );
  process.exit(1);
}

/*
 * Scale-tool drag.
 * Support the exact block produced by the previous 92% patch.
 */
const previousScaleBlock = `      const nextZoom = clamp(
        gesture.startZoom +
          (gesture.startClientY - event.clientY) / 220,
        MIN_SCENE_ZOOM,
        MAX_SCENE_ZOOM,
      );

      setSceneView((view) =>
        nextZoom <= MIN_SCENE_ZOOM + 0.0001
          ? {
              zoom: MIN_SCENE_ZOOM,
              panX: 0,
              panY: 0,
            }
          : {
              ...view,
              zoom: nextZoom,
            },
      );`;

const boundedScaleBlock = `      const nextZoom = clamp(
        gesture.startZoom +
          (gesture.startClientY - event.clientY) / 220,
        MIN_SCENE_ZOOM,
        MAX_SCENE_ZOOM,
      );

      setSceneView((view) => {
        if (
          nextZoom <=
          MIN_SCENE_ZOOM + 0.0001
        ) {
          return {
            zoom: MIN_SCENE_ZOOM,
            panX: 0,
            panY: 0,
          };
        }

        const boundedPan = clampScenePan(
          nextZoom,
          view.panX,
          view.panY,
        );

        return {
          ...view,
          zoom: nextZoom,
          ...boundedPan,
        };
      });`;

if (source.includes(previousScaleBlock)) {
  source = source.replace(
    previousScaleBlock,
    boundedScaleBlock,
  );
} else {
  /*
   * Original pre-92% block.
   */
  const originalScalePattern =
    /const nextZoom = clamp\(\s*gesture\.startZoom \+ \(gesture\.startClientY - event\.clientY\) \/ 220,\s*0\.4,\s*3,\s*\);\s*setSceneView\(\(view\) => \(\{ \.\.\.view, zoom: nextZoom \}\)\);/;

  if (originalScalePattern.test(source)) {
    source = source.replace(
      originalScalePattern,
      boundedScaleBlock.trim(),
    );
  } else if (
    !source.includes(
      "const boundedPan = clampScenePan(\n          nextZoom,",
    )
  ) {
    console.error(
      "Could not locate the Scale-tool zoom block.",
    );
    process.exit(1);
  }
}

/*
 * Arrow buttons get inline bounded panning.
 * This deliberately avoids adding another helper hook/insertion point.
 */
const panExpression = (dx, dy) =>
  `setSceneView((view) => {
                    const boundedPan = clampScenePan(
                      view.zoom,
                      view.panX + (${dx}),
                      view.panY + (${dy}),
                    );

                    return {
                      ...view,
                      ...boundedPan,
                    };
                  })`;

source = source.replace(
  /onClick=\{\(\) => setSceneView\(\(view\) => \(\{ \.\.\.view, panY: view\.panY \+ 40 \}\)\)\}/g,
  `onClick={() => ${panExpression("0", "40")}}`,
);

source = source.replace(
  /onClick=\{\(\) => setSceneView\(\(view\) => \(\{ \.\.\.view, panY: view\.panY - 40 \}\)\)\}/g,
  `onClick={() => ${panExpression("0", "-40")}}`,
);

source = source.replace(
  /onClick=\{\(\) => setSceneView\(\(view\) => \(\{ \.\.\.view, panX: view\.panX \+ 40 \}\)\)\}/g,
  `onClick={() => ${panExpression("40", "0")}}`,
);

source = source.replace(
  /onClick=\{\(\) => setSceneView\(\(view\) => \(\{ \.\.\.view, panX: view\.panX - 40 \}\)\)\}/g,
  `onClick={() => ${panExpression("-40", "0")}}`,
);

/*
 * FIT remains centred and uses the true minimum.
 */
source = source.replace(
  /\{\s*zoom:\s*0\.92,\s*panX:\s*0,\s*panY:\s*0\s*\}/g,
  "{ zoom: MIN_SCENE_ZOOM, panX: 0, panY: 0 }",
);

/*
 * Plus control.
 */
source = source.replace(
  /Math\.min\(3,\s*view\.zoom \+ 0\.1\)/g,
  "Math.min(MAX_SCENE_ZOOM, view.zoom + SCENE_ZOOM_STEP)",
);

/*
 * Minus control from the previous patch: clamp pan on every decrement, not
 * only once the minimum is reached.
 */
const oldMinusBody = `                  onClick={() =>
                    setSceneView((view) => {
                      const nextZoom = Math.max(
                        MIN_SCENE_ZOOM,
                        view.zoom - SCENE_ZOOM_STEP,
                      );

                      if (
                        nextZoom <=
                        MIN_SCENE_ZOOM + 0.0001
                      ) {
                        return {
                          zoom: MIN_SCENE_ZOOM,
                          panX: 0,
                          panY: 0,
                        };
                      }

                      return {
                        ...view,
                        zoom: nextZoom,
                      };
                    })
                  }`;

const newMinusBody = `                  onClick={() =>
                    setSceneView((view) => {
                      const nextZoom = Math.max(
                        MIN_SCENE_ZOOM,
                        view.zoom - SCENE_ZOOM_STEP,
                      );

                      if (
                        nextZoom <=
                        MIN_SCENE_ZOOM + 0.0001
                      ) {
                        return {
                          zoom: MIN_SCENE_ZOOM,
                          panX: 0,
                          panY: 0,
                        };
                      }

                      const boundedPan =
                        clampScenePan(
                          nextZoom,
                          view.panX,
                          view.panY,
                        );

                      return {
                        ...view,
                        zoom: nextZoom,
                        ...boundedPan,
                      };
                    })
                  }`;

if (source.includes(oldMinusBody)) {
  source = source.replace(
    oldMinusBody,
    newMinusBody,
  );
} else {
  /*
   * Support the original compact minus button.
   */
  source = source.replace(
    /onClick=\{\(\) => setSceneView\(\(view\) => \(\{ \.\.\.view, zoom: Math\.max\(0\.4, view\.zoom - 0\.1\) \}\)\)\}/g,
    `onClick={() =>
                    setSceneView((view) => {
                      const nextZoom = Math.max(
                        MIN_SCENE_ZOOM,
                        view.zoom - SCENE_ZOOM_STEP,
                      );

                      if (
                        nextZoom <=
                        MIN_SCENE_ZOOM + 0.0001
                      ) {
                        return {
                          zoom: MIN_SCENE_ZOOM,
                          panX: 0,
                          panY: 0,
                        };
                      }

                      const boundedPan =
                        clampScenePan(
                          nextZoom,
                          view.panX,
                          view.panY,
                        );

                      return {
                        ...view,
                        zoom: nextZoom,
                        ...boundedPan,
                      };
                    })
                  }`,
  );
}

/*
 * Safety checks.
 */
for (const forbidden of [
  "const MIN_SCENE_ZOOM = 0.92;",
  "zoom: 0.92",
  "Math.max(0.4, view.zoom",
  "clamp(view.zoom + zoomDelta, 0.4, 3)",
]) {
  if (source.includes(forbidden)) {
    console.error(
      `Legacy viewport rule still remains: ${forbidden}`,
    );
    process.exit(1);
  }
}

if (
  !source.includes("const MIN_SCENE_ZOOM = 1;") ||
  !source.includes("const clampScenePan = useCallback(") ||
  !source.includes("[clampScenePan]")
) {
  console.error(
    "The viewport boundary installation is incomplete.",
  );
  process.exit(1);
}

fs.writeFileSync(
  editorPath,
  source,
  "utf8",
);

console.log(
  "CHANGED src/components/reconstruction/AccidentReconstructionEditor.tsx",
);
console.log(
  "True 2D FIT / minimum zoom: 100%",
);
console.log(
  "Pan is bounded to selected-workspace edges.",
);

try {
  execSync(
    "npm run build",
    {
      cwd: root,
      stdio: "inherit",
      shell: true,
    },
  );
} catch {
  fs.copyFileSync(
    backupPath,
    editorPath,
  );

  console.error(`
Build failed.

The editor was restored automatically from:
  ${path.relative(root, backupPath)}
`);

  process.exit(1);
}

fs.mkdirSync(
  path.dirname(statePath),
  { recursive: true },
);

fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      installedAt:
        new Date().toISOString(),
      backupPath,
      relativePath,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`
Reconstruction viewport boundary V2 installed successfully.

Behavior:
- 100% is true FIT and the minimum zoom.
- No empty margin can appear at minimum zoom.
- At 100%, all panning is clamped to the centre.
- Above 100%, pan stops exactly at the workspace edges.
- Mouse wheel zoom is bounded.
- Scale-tool zoom is bounded.
- Arrow-button panning is bounded.
- Minus-button zoom-out reclamps pan at every step.
- Maximum zoom remains 300%.

Start:
  npm run dev

Rollback:
  node revoke-reconstruction-viewport-boundary-v2.mjs
`);
