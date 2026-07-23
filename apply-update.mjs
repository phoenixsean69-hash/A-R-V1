import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const updaterRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.cwd();

const editorRelative = "src/components/reconstruction/AccidentReconstructionEditor.tsx";
const viewerRelative = "src/components/reconstruction/Reconstruction3DViewer.tsx";
const helperRelative = "src/utils/reconstructionPlaybackDom.ts";

const editorPath = path.join(projectRoot, editorRelative);
const viewerPath = path.join(projectRoot, viewerRelative);
const helperPath = path.join(projectRoot, helperRelative);
const helperPayloadPath = path.join(updaterRoot, "payload", helperRelative);

function fail(message) {
  throw new Error(message);
}

function assertFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`${label} was not found at: ${filePath}\nRun this updater from the A-R-V1 project root.`);
  }
}

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) fail(`Could not locate ${label}. Your local file differs from the expected RoadSafe version.`);
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

function replaceRegexOnce(source, regex, replacement, label) {
  const matches = source.match(regex);
  if (!matches) fail(`Could not locate ${label}. Your local file differs from the expected RoadSafe version.`);
  return source.replace(regex, replacement);
}

function replaceBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) fail(`Could not locate the start of ${label}.`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) fail(`Could not locate the end of ${label}.`);
  return source.slice(0, start) + replacement + source.slice(end + endMarker.length);
}

function timestampForPath() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

assertFile(editorPath, "AccidentReconstructionEditor.tsx");
assertFile(viewerPath, "Reconstruction3DViewer.tsx");
assertFile(helperPayloadPath, "Playback helper payload");

const originalEditor = fs.readFileSync(editorPath, "utf8");
const originalViewer = fs.readFileSync(viewerPath, "utf8");
const originalHelper = fs.existsSync(helperPath) ? fs.readFileSync(helperPath, "utf8") : null;

let editor = originalEditor;
let viewer = originalViewer;

// ---------------------------------------------------------------------------
// 2D native-frame playback: remove React from the participant movement loop.
// ---------------------------------------------------------------------------
if (!editor.includes('from "../../utils/reconstructionPlaybackDom"')) {
  const importAnchor = `import {\n  updateMeasurementDistance,\n} from "../../utils/evidenceGeometry";\n`;
  editor = replaceOnce(
    editor,
    importAnchor,
    `${importAnchor}\nimport { paintReconstructionPlaybackDomFrame } from "../../utils/reconstructionPlaybackDom";\n`,
    "the evidenceGeometry import",
  );
}

if (!editor.includes("Native-frame DOM playback keeps participant movement")) {
  const playbackEffectRegex = /  useEffect\(\(\) => \{\n    if \(!isPlaying\) \{\n      lastFrameTimeRef\.current = null;[\s\S]*?\n  \}, \[\n    activeReconstructionView,\n    isPlaying,\n    playbackSpeed,\n    reconstruction\.durationSeconds,\n  \]\);/;

  const nativePlaybackEffect = `  useEffect(() => {\n    if (!isPlaying) {\n      lastFrameTimeRef.current = null;\n      lastPlaybackPaintRef.current = null;\n\n      if (animationFrameRef.current !== null) {\n        window.cancelAnimationFrame(animationFrameRef.current);\n        animationFrameRef.current = null;\n      }\n\n      const stoppedTime = currentTimeRef.current;\n      setCurrentTime((displayedTime) =>\n        Math.abs(displayedTime - stoppedTime) < 0.0005\n          ? displayedTime\n          : stoppedTime,\n      );\n      return;\n    }\n\n    const animate = (timestamp: number) => {\n      const previousTimestamp = lastFrameTimeRef.current ?? timestamp;\n      const elapsedSeconds = clamp(\n        (timestamp - previousTimestamp) / 1000,\n        0,\n        MAX_PLAYBACK_FRAME_DELTA_SECONDS,\n      );\n      lastFrameTimeRef.current = timestamp;\n\n      const nextTime = Math.min(\n        reconstruction.durationSeconds,\n        currentTimeRef.current + elapsedSeconds * playbackSpeed,\n      );\n\n      currentTimeRef.current = nextTime;\n\n      // Native-frame DOM playback keeps participant movement at the browser's\n      // refresh rate without rerendering the entire reconstruction editor.\n      paintReconstructionPlaybackDomFrame({\n        sceneRoot: sceneRef.current,\n        editorRoot:\n          sceneRef.current?.closest<HTMLElement>(".reconstruction-editor") ??\n          document.querySelector<HTMLElement>(".reconstruction-editor"),\n        reconstruction,\n        timeSeconds: nextTime,\n        timestamp,\n      });\n\n      if (nextTime >= reconstruction.durationSeconds) {\n        setCurrentTime(reconstruction.durationSeconds);\n        setIsPlaying(false);\n        animationFrameRef.current = null;\n        return;\n      }\n\n      animationFrameRef.current = window.requestAnimationFrame(animate);\n    };\n\n    animationFrameRef.current = window.requestAnimationFrame(animate);\n\n    return () => {\n      if (animationFrameRef.current !== null) {\n        window.cancelAnimationFrame(animationFrameRef.current);\n        animationFrameRef.current = null;\n      }\n\n      lastFrameTimeRef.current = null;\n      lastPlaybackPaintRef.current = null;\n    };\n  }, [isPlaying, playbackSpeed, reconstruction]);`;

  editor = replaceRegexOnce(
    editor,
    playbackEffectRegex,
    nativePlaybackEffect,
    "the existing playback animation effect",
  );
}

// The previous 3D React repaint throttle is obsolete after native DOM playback.
editor = editor.replace(/^const THREE_D_REACT_PAINT_INTERVAL_MS[^\n]*\n/m, "");

const pauseBranch = `    if (isPlaying) {\n      setIsPlaying(false);\n      return;\n    }`;
const syncedPauseBranch = `    if (isPlaying) {\n      const pausedTime = currentTimeRef.current;\n      setCurrentTime(pausedTime);\n      setIsPlaying(false);\n      return;\n    }`;
if (!editor.includes("const pausedTime = currentTimeRef.current;")) {
  editor = replaceOnce(editor, pauseBranch, syncedPauseBranch, "the editor Play/Pause pause branch");
}

if (!editor.includes("data-playback-participant-id={participant.id}")) {
  const participantButton = `                    <button\n                      type="button"\n                      data-scene-interactive="true"\n                      onClick={(event) => {\n                        event.stopPropagation();\n                        handleSelectParticipant(participant.id, state.activePointId);\n                      }}`;
  editor = replaceOnce(
    editor,
    participantButton,
    `                    <button\n                      type="button"\n                      data-scene-interactive="true"\n                      data-playback-participant-id={participant.id}\n                      onClick={(event) => {\n                        event.stopPropagation();\n                        handleSelectParticipant(participant.id, state.activePointId);\n                      }}`,
    "the moving 2D participant button",
  );
}

if (!editor.includes("data-playback-vector-line-id={participant.id}")) {
  editor = replaceOnce(
    editor,
    `                        <line\n                          x1={state.position.x}`,
    `                        <line\n                          data-playback-vector-line-id={participant.id}\n                          x1={state.position.x}`,
    "the 2D velocity vector line",
  );
}

if (!editor.includes("data-playback-vector-tip-id={participant.id}")) {
  editor = replaceOnce(
    editor,
    `                        <circle\n                          cx={vectorEnd.x}`,
    `                        <circle\n                          data-playback-vector-tip-id={participant.id}\n                          cx={vectorEnd.x}`,
    "the 2D velocity vector tip",
  );
}

if (!editor.includes("data-playback-speed-label-id={participant.id}")) {
  const speedLabelAnchor = `                      <span\n                        className="pointer-events-none absolute z-[32] -translate-x-1/2 rounded-full bg-slate-950/80 px-2 py-0.5 text-[9px] font-black text-white shadow"`;
  editor = replaceOnce(
    editor,
    speedLabelAnchor,
    `                      <span\n                        data-playback-speed-label-id={participant.id}\n                        className="pointer-events-none absolute z-[32] -translate-x-1/2 rounded-full bg-slate-950/80 px-2 py-0.5 text-[9px] font-black text-white shadow"`,
    "the 2D speed label",
  );
}

if (!editor.includes("data-playback-smoke-id={participant.id}")) {
  const smokeStart = `                    {(activeAction === "Brake" || activeAction === "Slide") && state.speedKmh > 5 && (\n`;
  const smokeEnd = `                      </div>\n                    )}`;
  const smokeReplacement = `                    <div\n                      data-playback-smoke-id={participant.id}\n                      className="pointer-events-none absolute z-[28] -translate-x-1/2 -translate-y-1/2"\n                      style={{\n                        left: \`${"${state.position.x}"}%\`,\n                        top: \`${"${state.position.y}"}%\`,\n                        display:\n                          (activeAction === "Brake" || activeAction === "Slide") &&\n                          state.speedKmh > 5\n                            ? "block"\n                            : "none",\n                      }}\n                    >\n                      <span className="absolute h-8 w-8 -translate-x-5 -translate-y-2 rounded-full bg-slate-200/35" />\n                      <span className="absolute h-5 w-5 -translate-x-8 translate-y-1 rounded-full bg-white/35" />\n                    </div>`;
  editor = replaceBetween(
    editor,
    smokeStart,
    smokeEnd,
    smokeReplacement,
    "the conditional 2D braking smoke block",
  );
}

if (!editor.includes("data-playback-clock")) {
  editor = replaceOnce(
    editor,
    `<strong>{currentTime.toFixed(2)}s</strong>`,
    `<strong data-playback-clock>{currentTime.toFixed(2)}s</strong>`,
    "the playback clock",
  );
}

// ---------------------------------------------------------------------------
// 3D camera preservation: keep Orbit position/target across physics rebuilds.
// ---------------------------------------------------------------------------
if (!viewer.includes("interface PersistedOrbitCameraState")) {
  const cameraTypeAnchor = `type CameraMode = "Orbit" | "Overhead" | "Roadside" | "Driver";\ntype TerrainLoadStatus = "Disabled" | "Loading" | "Ready" | "Unavailable" | "Error";`;
  viewer = replaceOnce(
    viewer,
    cameraTypeAnchor,
    `${cameraTypeAnchor}\n\ninterface PersistedOrbitCameraState {\n  position: THREE.Vector3;\n  target: THREE.Vector3;\n  up: THREE.Vector3;\n  zoom: number;\n}`,
    "the 3D camera type declarations",
  );
}

if (!viewer.includes("persistedOrbitCameraRef")) {
  viewer = replaceOnce(
    viewer,
    `  const rendererElementRef = useRef<HTMLCanvasElement | null>(null);\n`,
    `  const rendererElementRef = useRef<HTMLCanvasElement | null>(null);\n  const persistedOrbitCameraRef = useRef<PersistedOrbitCameraState | null>(null);\n`,
    "the 3D renderer refs",
  );
}

if (!viewer.includes("const persistedOrbitCamera = persistedOrbitCameraRef.current;")) {
  const cameraInitialisation = `    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);\n    camera.position.set(width * 0.65, Math.max(width, height) * 0.7, height * 0.7);`;
  const persistentCameraInitialisation = `    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);\n    const persistedOrbitCamera = persistedOrbitCameraRef.current;\n    if (persistedOrbitCamera) {\n      camera.position.copy(persistedOrbitCamera.position);\n      camera.up.copy(persistedOrbitCamera.up);\n      camera.zoom = persistedOrbitCamera.zoom;\n      camera.updateProjectionMatrix();\n    } else {\n      camera.position.set(\n        width * 0.65,\n        Math.max(width, height) * 0.7,\n        height * 0.7,\n      );\n    }`;
  viewer = replaceOnce(
    viewer,
    cameraInitialisation,
    persistentCameraInitialisation,
    "the default 3D camera initialisation",
  );
}

if (!viewer.includes("controls.target.copy(persistedOrbitCamera.target)")) {
  viewer = replaceOnce(
    viewer,
    `    controls.enableDamping = true;\n    controls.target.set(0, 0, 0);`,
    `    controls.enableDamping = true;\n    if (persistedOrbitCamera) {\n      controls.target.copy(persistedOrbitCamera.target);\n    } else {\n      controls.target.set(0, 0, 0);\n    }`,
    "the default OrbitControls target",
  );
}

if (!viewer.includes("const rememberOrbitCamera = () =>")) {
  const controlsAnchor = `    if (workspaceMode) {\n      configureWorkspaceControls(controls, renderer.domElement, workspaceToolRef.current);\n    }\n    scene.add(new THREE.HemisphereLight(`;
  const controlsWithMemory = `    if (workspaceMode) {\n      configureWorkspaceControls(controls, renderer.domElement, workspaceToolRef.current);\n    }\n\n    const rememberOrbitCamera = () => {\n      if (cameraModeRef.current !== "Orbit") return;\n      persistedOrbitCameraRef.current = {\n        position: camera.position.clone(),\n        target: controls.target.clone(),\n        up: camera.up.clone(),\n        zoom: camera.zoom,\n      };\n    };\n    controls.addEventListener("change", rememberOrbitCamera);\n\n    scene.add(new THREE.HemisphereLight(`;
  viewer = replaceOnce(
    viewer,
    controlsAnchor,
    controlsWithMemory,
    "the OrbitControls workspace configuration",
  );
}

if (!viewer.includes('controls.removeEventListener("change", rememberOrbitCamera);')) {
  viewer = replaceOnce(
    viewer,
    `      controls.dispose();\n`,
    `      rememberOrbitCamera();\n      controls.removeEventListener("change", rememberOrbitCamera);\n      controls.dispose();\n`,
    "the 3D OrbitControls cleanup",
  );
}

const changedFiles = [];
if (editor !== originalEditor) changedFiles.push(editorRelative);
if (viewer !== originalViewer) changedFiles.push(viewerRelative);
const helperPayload = fs.readFileSync(helperPayloadPath, "utf8");
if (originalHelper !== helperPayload) changedFiles.push(helperRelative);

if (changedFiles.length === 0) {
  console.log("RoadSafe smooth-playback update is already applied.");
  process.exit(0);
}

const backupRoot = path.join(
  projectRoot,
  ".roadsafe-backups",
  timestampForPath(),
);

function backup(relativePath, contents) {
  if (contents === null) return;
  const destination = path.join(backupRoot, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, contents, "utf8");
}

backup(editorRelative, originalEditor);
backup(viewerRelative, originalViewer);
backup(helperRelative, originalHelper);

fs.writeFileSync(editorPath, editor, "utf8");
fs.writeFileSync(viewerPath, viewer, "utf8");
fs.mkdirSync(path.dirname(helperPath), { recursive: true });
fs.writeFileSync(helperPath, helperPayload, "utf8");

console.log("RoadSafe update applied successfully.");
console.log(`Backups: ${path.relative(projectRoot, backupRoot)}`);
console.log("Changed/created files:");
for (const file of changedFiles) console.log(`  - ${file}`);
console.log("Keep npm run dev running; Vite should reload the update.");
