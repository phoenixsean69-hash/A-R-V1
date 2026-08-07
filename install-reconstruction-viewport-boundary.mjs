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

const requiredMarkers = [
  "sceneViewportRef",
  "zoomSceneAtClientPoint",
  'title="Pan map north"',
  'title="Pan map south"',
  'title="Pan map west"',
  'title="Pan map east"',
  'title="Fit the complete map"',
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) {
    console.error(
      `Expected reconstruction viewport marker not found: ${marker}`,
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

fs.copyFileSync(editorPath, backupPath);

const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-reconstruction-viewport-boundary.json",
);

/*
 * The workspace layer is exactly the viewport size before transforms.
 * Therefore 1.0 is the true minimum scale that fully covers the viewport.
 */
source = source.replace(
  /const MIN_SCENE_ZOOM = 0\.92;/,
  "const MIN_SCENE_ZOOM = 1;",
);

if (!source.includes("const MIN_SCENE_ZOOM = 1;")) {
  /*
   * Support repositories where the previous minimum-zoom patch was not kept.
   */
  const constantsAnchor =
    "const MAX_PLAYBACK_FRAME_DELTA_SECONDS = 0.05;";

  if (!source.includes(constantsAnchor)) {
    console.error(
      "Could not locate the reconstruction constants block.",
    );
    process.exit(1);
  }

  source = source.replace(
    constantsAnchor,
    `${constantsAnchor}
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
 * Any remaining literal FIT 0.92 becomes the true 100% fit.
 */
source = source.replace(
  /zoom:\s*0\.92/g,
  "zoom: MIN_SCENE_ZOOM",
);

source = source.replace(
  /useState\(\{\s*zoom:\s*MIN_SCENE_ZOOM,\s*panX:\s*0,\s*panY:\s*0\s*\}\)/,
  "useState({ zoom: MIN_SCENE_ZOOM, panX: 0, panY: 0 })",
);

/*
 * Add one canonical pan-boundary helper before zoomSceneAtClientPoint.
 *
 * At zoom 1.0:
 *   maxPanX = 0
 *   maxPanY = 0
 *
 * At zoom > 1:
 *   pan may move only through the extra scaled content.
 */
if (!source.includes("const clampScenePan = useCallback(")) {
  const anchor =
    "  const zoomSceneAtClientPoint = useCallback(";

  if (!source.includes(anchor)) {
    console.error(
      "Could not locate zoomSceneAtClientPoint.",
    );
    process.exit(1);
  }

  const helper = `  const clampScenePan = useCallback(
    (
      zoom: number,
      panX: number,
      panY: number,
    ) => {
      const rectangle =
        sceneViewportRef.current?.getBoundingClientRect();

      if (!rectangle) {
        return { panX, panY };
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
 * Normalize the pointer-centred zoom callback to use the boundary helper.
 * Handles both the original 40% version and the previous 92% patch.
 */
const zoomCallbackStart =
  source.indexOf(
    "  const zoomSceneAtClientPoint = useCallback(",
  );

const zoomCallbackEnd =
  source.indexOf(
    "\n\n  useEffect(() =>",
    zoomCallbackStart,
  );

if (
  zoomCallbackStart < 0 ||
  zoomCallbackEnd < 0
) {
  console.error(
    "Could not isolate zoomSceneAtClientPoint.",
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
  source.slice(0, zoomCallbackStart) +
  zoomCallback +
  source.slice(zoomCallbackEnd);

/*
 * Pan gesture: clamp every drag frame so the viewport can never reveal empty
 * space beyond a selected-workspace edge.
 */
const panGestureOld = `        setSceneView((view) => ({
          ...view,
          panX: gesture.startPanX + event.clientX - gesture.startClientX,
          panY: gesture.startPanY + event.clientY - gesture.startClientY,
        }));
        return;`;

const panGestureNew = `        setSceneView((view) => {
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

if (source.includes(panGestureOld)) {
  source = source.replace(
    panGestureOld,
    panGestureNew,
  );
} else if (
  !source.includes(
    "const boundedPan = clampScenePan(\n            view.zoom,",
  )
) {
  console.error(
    "Could not locate the 2D pan gesture block.",
  );
  process.exit(1);
}

/*
 * Scale-tool zoom: clamp scale and then clamp pan for the new scale.
 */
const scalePattern =
  /const nextZoom = clamp\([\s\S]*?gesture\.startZoom[\s\S]*?\/ 220,[\s\S]*?(?:MIN_SCENE_ZOOM|0\.4),[\s\S]*?(?:MAX_SCENE_ZOOM|3),[\s\S]*?\);[\s\S]*?setSceneView\(\(view\) =>[\s\S]*?\);/;

const scaleMatch =
  source.match(scalePattern);

if (scaleMatch) {
  const replacement = `const nextZoom = clamp(
        gesture.startZoom +
          (gesture.startClientY -
            event.clientY) /
            220,
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

  source = source.replace(
    scaleMatch[0],
    replacement,
  );
}

/*
 * Add a small reusable nudge helper before JSX helpers / render return.
 */
if (!source.includes("const nudgeScenePan = useCallback(")) {
  const nudgeAnchor =
    "  const showSaveMessage = useCallback(";

  if (!source.includes(nudgeAnchor)) {
    console.error(
      "Could not locate showSaveMessage for nudge helper insertion.",
    );
    process.exit(1);
  }

  const nudgeHelper = `  const nudgeScenePan = useCallback(
    (
      deltaX: number,
      deltaY: number,
    ) => {
      setSceneView((view) => {
        const boundedPan = clampScenePan(
          view.zoom,
          view.panX + deltaX,
          view.panY + deltaY,
        );

        return {
          ...view,
          ...boundedPan,
        };
      });
    },
    [clampScenePan],
  );

`;

  source = source.replace(
    nudgeAnchor,
    nudgeHelper + nudgeAnchor,
  );
}

/*
 * Arrow controls now use the same boundary helper.
 */
source = source.replace(
  /onClick=\{\(\) => setSceneView\(\(view\) => \(\{ \.\.\.view, panY: view\.panY \+ 40 \}\)\)\}/g,
  "onClick={() => nudgeScenePan(0, 40)}",
);

source = source.replace(
  /onClick=\{\(\) => setSceneView\(\(view\) => \(\{ \.\.\.view, panY: view\.panY - 40 \}\)\)\}/g,
  "onClick={() => nudgeScenePan(0, -40)}",
);

source = source.replace(
  /onClick=\{\(\) => setSceneView\(\(view\) => \(\{ \.\.\.view, panX: view\.panX \+ 40 \}\)\)\}/g,
  "onClick={() => nudgeScenePan(40, 0)}",
);

source = source.replace(
  /onClick=\{\(\) => setSceneView\(\(view\) => \(\{ \.\.\.view, panX: view\.panX - 40 \}\)\)\}/g,
  "onClick={() => nudgeScenePan(-40, 0)}",
);

/*
 * If the previous min-zoom patch already converted the minus button, keep it.
 * Otherwise convert the original 40% button.
 */
source = source.replace(
  /Math\.max\(0\.4,\s*view\.zoom - 0\.1\)/g,
  "Math.max(MIN_SCENE_ZOOM, view.zoom - SCENE_ZOOM_STEP)",
);

source = source.replace(
  /Math\.min\(3,\s*view\.zoom \+ 0\.1\)/g,
  "Math.min(MAX_SCENE_ZOOM, view.zoom + SCENE_ZOOM_STEP)",
);

/*
 * Guarantee FIT is 100%.
 */
source = source.replace(
  /\{\s*zoom:\s*0\.92,\s*panX:\s*0,\s*panY:\s*0\s*\}/g,
  "{ zoom: MIN_SCENE_ZOOM, panX: 0, panY: 0 }",
);

/*
 * Clamp after viewport resize as well.
 */
if (
  !source.includes(
    "const resizeObserver = new ResizeObserver(",
  )
) {
  const wheelEffectMarker =
    "  const showSaveMessage = useCallback(";

  if (!source.includes(wheelEffectMarker)) {
    console.error(
      "Could not locate resize-effect insertion point.",
    );
    process.exit(1);
  }

  const resizeEffect = `  useEffect(() => {
    const viewport =
      sceneViewportRef.current;

    if (
      !viewport ||
      activeReconstructionView !== "2D"
    ) {
      return;
    }

    const constrainCurrentView = () => {
      setSceneView((view) => {
        if (
          view.zoom <=
          MIN_SCENE_ZOOM + 0.0001
        ) {
          if (
            view.zoom === MIN_SCENE_ZOOM &&
            view.panX === 0 &&
            view.panY === 0
          ) {
            return view;
          }

          return {
            zoom: MIN_SCENE_ZOOM,
            panX: 0,
            panY: 0,
          };
        }

        const boundedPan = clampScenePan(
          view.zoom,
          view.panX,
          view.panY,
        );

        if (
          boundedPan.panX === view.panX &&
          boundedPan.panY === view.panY
        ) {
          return view;
        }

        return {
          ...view,
          ...boundedPan,
        };
      });
    };

    constrainCurrentView();

    const resizeObserver =
      new ResizeObserver(
        constrainCurrentView,
      );

    resizeObserver.observe(viewport);

    return () => {
      resizeObserver.disconnect();
    };
  }, [
    activeReconstructionView,
    clampScenePan,
  ]);

`;

  source = source.replace(
    wheelEffectMarker,
    resizeEffect + wheelEffectMarker,
  );
}

/*
 * Safety checks.
 */
const forbidden = [
  "zoom: 0.92",
  "Math.max(0.4, view.zoom",
  "clamp(view.zoom + zoomDelta, 0.4, 3)",
];

for (const text of forbidden) {
  if (source.includes(text)) {
    console.error(
      `Legacy viewport rule still remains: ${text}`,
    );
    process.exit(1);
  }
}

if (
  !source.includes("const MIN_SCENE_ZOOM = 1;") ||
  !source.includes("const clampScenePan = useCallback(") ||
  !source.includes("const nudgeScenePan = useCallback(")
) {
  console.error(
    "Viewport boundary helpers were not installed completely.",
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
  "True selected-workspace FIT: 100%",
);
console.log(
  "Pan boundary: workspace edges cannot enter viewport",
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

AccidentReconstructionEditor.tsx has been restored automatically from:
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
Reconstruction viewport boundary installed successfully.

Final behavior:
- 100% is the minimum / true FIT scale.
- No empty strip can appear at minimum zoom.
- At 100%, pan is locked to the centre.
- Above 100%, panning is clamped to the scaled workspace edges.
- Wheel zoom obeys the boundary.
- Scale-tool zoom obeys the boundary.
- Arrow-button panning obeys the boundary.
- Viewport resize re-applies the boundary.
- Maximum zoom remains 300%.

Start:
  npm run dev

Rollback:
  node revoke-reconstruction-viewport-boundary.mjs
`);
