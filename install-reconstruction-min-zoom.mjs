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

const source = fs.readFileSync(editorPath, "utf8");

const requiredMarkers = [
  'const [sceneView, setSceneView] = useState({ zoom:',
  'const zoomSceneAtClientPoint = useCallback(',
  'title="Zoom map out"',
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
  "last-reconstruction-min-zoom.json",
);

let next = source;

/*
 * Canonical viewport zoom limits.
 * 0.92 is the existing FIT scale and therefore becomes the minimum legal zoom.
 */
if (!next.includes("const MIN_SCENE_ZOOM = 0.92;")) {
  const anchor =
    "const MAX_PLAYBACK_FRAME_DELTA_SECONDS = 0.05;";

  if (!next.includes(anchor)) {
    console.error(
      "Could not find the constants block in AccidentReconstructionEditor.tsx.",
    );
    process.exit(1);
  }

  next = next.replace(
    anchor,
    `${anchor}
const MIN_SCENE_ZOOM = 0.92;
const MAX_SCENE_ZOOM = 3;
const SCENE_ZOOM_STEP = 0.1;`,
  );
}

/*
 * Initial view = FIT.
 */
next = next.replace(
  /useState\(\{\s*zoom:\s*0\.92,\s*panX:\s*0,\s*panY:\s*0\s*\}\)/,
  "useState({ zoom: MIN_SCENE_ZOOM, panX: 0, panY: 0 })",
);

/*
 * Mouse-wheel / pointer-centred zoom.
 * If the view reaches FIT, snap pan back to zero as well.
 */
const zoomCallbackPattern =
  /const nextZoom = clamp\(view\.zoom \+ zoomDelta,\s*0\.4,\s*3\);\s*if \(nextZoom === view\.zoom\) return view;/;

if (!zoomCallbackPattern.test(next)) {
  console.error(
    "Could not locate the mouse-wheel zoom clamp.",
  );
  process.exit(1);
}

next = next.replace(
  zoomCallbackPattern,
  `const nextZoom = clamp(
          view.zoom + zoomDelta,
          MIN_SCENE_ZOOM,
          MAX_SCENE_ZOOM,
        );

        if (nextZoom === view.zoom) {
          return view;
        }

        if (nextZoom <= MIN_SCENE_ZOOM + 0.0001) {
          return {
            zoom: MIN_SCENE_ZOOM,
            panX: 0,
            panY: 0,
          };
        }`,
);

/*
 * Scale-tool drag.
 */
const scaleGesturePattern =
  /const nextZoom = clamp\(\s*gesture\.startZoom \+ \(gesture\.startClientY - event\.clientY\) \/ 220,\s*0\.4,\s*3,\s*\);\s*setSceneView\(\(view\) => \(\{ \.\.\.view, zoom: nextZoom \}\)\);/;

if (!scaleGesturePattern.test(next)) {
  console.error(
    "Could not locate the Scale-tool zoom clamp.",
  );
  process.exit(1);
}

next = next.replace(
  scaleGesturePattern,
  `const nextZoom = clamp(
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
      );`,
);

/*
 * Map-control buttons:
 * + uses MAX_SCENE_ZOOM
 * FIT resets to MIN_SCENE_ZOOM
 * - stops at MIN_SCENE_ZOOM and recentres when it reaches FIT.
 */
next = next.replace(
  /Math\.min\(3,\s*view\.zoom \+ 0\.1\)/g,
  "Math.min(MAX_SCENE_ZOOM, view.zoom + SCENE_ZOOM_STEP)",
);

next = next.replace(
  /\{\s*zoom:\s*0\.92,\s*panX:\s*0,\s*panY:\s*0\s*\}/g,
  "{ zoom: MIN_SCENE_ZOOM, panX: 0, panY: 0 }",
);

const minusButtonPattern =
  /<button type="button" title="Zoom map out" aria-label="Zoom map out" onClick=\{\(\) => setSceneView\(\(view\) => \(\{ \.\.\.view, zoom: Math\.max\(0\.4, view\.zoom - 0\.1\) \}\)\)\} className="([^"]*)">−<\/button>/;

if (!minusButtonPattern.test(next)) {
  console.error(
    "Could not locate the 2D map Zoom out button.",
  );
  process.exit(1);
}

next = next.replace(
  minusButtonPattern,
  `<button
                  type="button"
                  title={
                    sceneView.zoom <= MIN_SCENE_ZOOM + 0.0001
                      ? "Selected workspace is already fully fitted"
                      : "Zoom map out"
                  }
                  aria-label="Zoom map out"
                  disabled={
                    sceneView.zoom <= MIN_SCENE_ZOOM + 0.0001
                  }
                  onClick={() =>
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
                  }
                  className="$1"
                >
                  −
                </button>`,
);

/*
 * Make accidental future 40% zoom regressions fail immediately.
 */
if (
  next.includes("Math.max(0.4, view.zoom") ||
  next.includes("clamp(view.zoom + zoomDelta, 0.4, 3") ||
  /gesture\.startZoom[\s\S]{0,160}\b0\.4,\s*3\b/.test(next)
) {
  console.error(
    "A legacy 40% reconstruction zoom clamp remains after the patch.",
  );
  process.exit(1);
}

fs.writeFileSync(
  editorPath,
  next,
  "utf8",
);

console.log(
  "CHANGED src/components/reconstruction/AccidentReconstructionEditor.tsx",
);
console.log(
  "2D minimum zoom: 92% (selected-workspace FIT)",
);
console.log(
  "2D maximum zoom: 300%",
);

try {
  execSync("npm run build", {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
} catch {
  fs.copyFileSync(
    backupPath,
    editorPath,
  );

  console.error(`
Build failed.

AccidentReconstructionEditor.tsx was restored automatically from:
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
      installedAt: new Date().toISOString(),
      backupPath,
      relativePath,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`
Reconstruction zoom boundary installed successfully.

Result:
- FIT = 92%.
- 92% is now the minimum legal 2D zoom.
- Mouse wheel cannot zoom below FIT.
- Scale-tool drag cannot zoom below FIT.
- Minus button cannot zoom below FIT.
- Minus is disabled once FIT is reached.
- Reaching minimum zoom recentres the selected workspace.
- Zooming in remains available up to 300%.

Start:
  npm run dev

Rollback:
  node revoke-reconstruction-min-zoom.mjs
`);
