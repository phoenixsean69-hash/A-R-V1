import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(process.cwd());
const editorPath = join(
  projectRoot,
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
);
const viewerPath = join(
  projectRoot,
  "src/components/reconstruction/Reconstruction3DViewer.tsx",
);
const packagedCssPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "src/components/reconstruction/reconstructionPlaybackFixes.css",
);
const targetCssPath = join(
  projectRoot,
  "src/components/reconstruction/reconstructionPlaybackFixes.css",
);

function fail(message) {
  throw new Error(`RoadSafe update stopped: ${message}`);
}

function replaceRequired(source, searchValue, replacement, description) {
  if (source.includes(replacement)) return source;
  if (!source.includes(searchValue)) {
    fail(`Could not find ${description}. Your file may differ from the expected version.`);
  }
  return source.replace(searchValue, replacement);
}

function replaceRegexRequired(source, pattern, replacement, description) {
  if (!pattern.test(source)) {
    fail(`Could not find ${description}. Your file may differ from the expected version.`);
  }
  return source.replace(pattern, replacement);
}

function addDependency(source, oldDependencyList, newDependencyList, description) {
  if (source.includes(newDependencyList)) return source;
  return replaceRequired(source, oldDependencyList, newDependencyList, description);
}

async function backupFile(path, backupRoot) {
  const relative = path.slice(projectRoot.length + 1);
  const destination = join(backupRoot, relative);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(path, destination);
}

async function main() {
  let editor;
  let viewer;

  try {
    [editor, viewer] = await Promise.all([
      readFile(editorPath, "utf8"),
      readFile(viewerPath, "utf8"),
    ]);
  } catch (error) {
    fail(
      "Run this script from the A-R-V1 project root. Expected both reconstruction source files under src/components/reconstruction.",
    );
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = join(projectRoot, ".roadsafe-backups", timestamp);
  await Promise.all([
    backupFile(editorPath, backupRoot),
    backupFile(viewerPath, backupRoot),
  ]);

  // ---------------------------------------------------------------------------
  // AccidentReconstructionEditor.tsx
  // ---------------------------------------------------------------------------

  if (!editor.includes('import "./reconstructionPlaybackFixes.css";')) {
    editor = replaceRequired(
      editor,
      'const Reconstruction3DViewer = lazy(() => import("./Reconstruction3DViewer"));',
      'import "./reconstructionPlaybackFixes.css";\n\nconst Reconstruction3DViewer = lazy(() => import("./Reconstruction3DViewer"));',
      "the lazy Reconstruction3DViewer declaration",
    );
  }

  if (!editor.includes("MAX_PLAYBACK_FRAME_DELTA_SECONDS")) {
    editor = replaceRequired(
      editor,
      "const MAX_TRACE_POINTS = 250;",
      [
        "const MAX_TRACE_POINTS = 250;",
        "const MAX_PLAYBACK_FRAME_DELTA_SECONDS = 0.05;",
        "const THREE_D_REACT_PAINT_INTERVAL_MS = 80;",
      ].join("\n"),
      "the reconstruction constants section",
    );
  }

  if (!editor.includes('useState<"2D" | "3D">("2D")')) {
    editor = replaceRegexRequired(
      editor,
      /const \[activeReconstructionView, setActiveReconstructionView\] = useState<"2D" \| "3D">\("3D"\);/,
      'const [activeReconstructionView, setActiveReconstructionView] = useState<"2D" | "3D">("2D");',
      "the initial reconstruction view",
    );
  }

  if (!editor.includes('setActiveReconstructionView("2D");\n      setDragState(null);')) {
    editor = replaceRequired(
      editor,
      "setIsPlaying(false);\n      setDragState(null);",
      'setIsPlaying(false);\n      setActiveReconstructionView("2D");\n      setDragState(null);',
      "the reconstruction reload reset sequence",
    );
  }

  if (!editor.includes("workspaceTimeSourceRef={currentTimeRef}")) {
    editor = replaceRegexRequired(
      editor,
      /(workspaceTimeSeconds=\{currentTime\}\s*\n\s*)(workspacePlaying=\{isPlaying\})/,
      "$1workspaceTimeSourceRef={currentTimeRef}\n                  $2",
      "the 3D workspace playback props",
    );
  }

  editor = replaceRequired(
    editor,
    "if (!livePhysicsEnabled || physicsParticipantCount < 1) return;",
    "if (isPlaying || !livePhysicsEnabled || physicsParticipantCount < 1) return;",
    "the live-physics playback guard",
  );

  editor = addDependency(
    editor,
    "}, [livePhysicsEnabled, physicsInputSignature, physicsParticipantCount]);",
    "}, [isPlaying, livePhysicsEnabled, physicsInputSignature, physicsParticipantCount]);",
    "the live-physics effect dependencies",
  );

  const smoothPlaybackEffect = `  useEffect(() => {
    if (!isPlaying) {
      lastFrameTimeRef.current = null;
      lastPlaybackPaintRef.current = null;

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      return;
    }

    const animate = (timestamp: number) => {
      const previousTimestamp = lastFrameTimeRef.current ?? timestamp;
      const elapsedSeconds = clamp(
        (timestamp - previousTimestamp) / 1000,
        0,
        MAX_PLAYBACK_FRAME_DELTA_SECONDS,
      );
      lastFrameTimeRef.current = timestamp;

      const nextTime = Math.min(
        reconstruction.durationSeconds,
        currentTimeRef.current + elapsedSeconds * playbackSpeed,
      );

      // This ref is the authoritative clock shared by 2D and 3D.
      currentTimeRef.current = nextTime;

      // 2D needs a React paint every animation frame. The Three.js view reads the
      // shared ref directly, so its surrounding React UI can update less often.
      const reactPaintInterval =
        activeReconstructionView === "2D"
          ? 0
          : THREE_D_REACT_PAINT_INTERVAL_MS;

      if (
        reactPaintInterval === 0 ||
        lastPlaybackPaintRef.current === null ||
        timestamp - lastPlaybackPaintRef.current >= reactPaintInterval ||
        nextTime >= reconstruction.durationSeconds
      ) {
        lastPlaybackPaintRef.current = timestamp;
        setCurrentTime(nextTime);
      }

      if (nextTime >= reconstruction.durationSeconds) {
        setCurrentTime(reconstruction.durationSeconds);
        setIsPlaying(false);
        animationFrameRef.current = null;
        return;
      }

      animationFrameRef.current = window.requestAnimationFrame(animate);
    };

    animationFrameRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      lastFrameTimeRef.current = null;
      lastPlaybackPaintRef.current = null;
    };
  }, [
    activeReconstructionView,
    isPlaying,
    playbackSpeed,
    reconstruction.durationSeconds,
  ]);`;

  if (!editor.includes("This ref is the authoritative clock shared by 2D and 3D.")) {
    editor = replaceRegexRequired(
      editor,
      /  useEffect\(\(\) => \{\n    if \(!isPlaying\) \{\n      lastFrameTimeRef\.current = null;\n      lastPlaybackPaintRef\.current = null;[\s\S]*?\n  \}, \[isPlaying, playbackSpeed, reconstruction\.durationSeconds\]\);/,
      smoothPlaybackEffect,
      "the existing reconstruction playback animation effect",
    );
  }

  // ---------------------------------------------------------------------------
  // Reconstruction3DViewer.tsx
  // ---------------------------------------------------------------------------

  if (!viewer.includes("workspaceTimeSourceRef?: { readonly current: number };")) {
    viewer = replaceRequired(
      viewer,
      "  workspaceTimeSeconds?: number;\n  workspacePlaying?: boolean;",
      "  workspaceTimeSeconds?: number;\n  workspaceTimeSourceRef?: { readonly current: number };\n  workspacePlaying?: boolean;",
      "the 3D viewer workspace time props",
    );
  }

  if (!viewer.includes("  workspaceTimeSourceRef,\n  workspacePlaying,")) {
    viewer = replaceRequired(
      viewer,
      "  workspaceTimeSeconds,\n  workspacePlaying,",
      "  workspaceTimeSeconds,\n  workspaceTimeSourceRef,\n  workspacePlaying,",
      "the 3D viewer prop destructuring",
    );
  }

  if (!viewer.includes("workspaceTimeSourceRef?.current ??")) {
    viewer = replaceRequired(
      viewer,
      "      if (controlledWorkspace) {\n        timeRef.current = workspaceTimeRef.current;\n      } else if (playingRef.current) {",
      "      if (controlledWorkspace) {\n        timeRef.current =\n          workspaceTimeSourceRef?.current ??\n          workspaceTimeRef.current;\n      } else if (playingRef.current) {",
      "the controlled 3D animation clock",
    );
  }

  viewer = replaceRequired(
    viewer,
    "const delta = Math.min(0.08, (now - previous) / 1000);",
    "const delta = Math.min(0.05, Math.max(0, (now - previous) / 1000));",
    "the standalone 3D playback frame clamp",
  );

  viewer = addDependency(
    viewer,
    "}, [controlledWorkspace, reconstruction, effectiveShowEvidence, effectiveShowObjects, effectiveShowPaths, effectiveShowPhysicsEffects, terrainGrid, workspaceMode]);",
    "}, [controlledWorkspace, reconstruction, effectiveShowEvidence, effectiveShowObjects, effectiveShowPaths, effectiveShowPhysicsEffects, terrainGrid, workspaceMode, workspaceTimeSourceRef]);",
    "the 3D scene effect dependencies",
  );

  // Validate the final markers before writing anything.
  const editorMarkers = [
    'useState<"2D" | "3D">("2D")',
    "workspaceTimeSourceRef={currentTimeRef}",
    "MAX_PLAYBACK_FRAME_DELTA_SECONDS",
    "This ref is the authoritative clock shared by 2D and 3D.",
    'import "./reconstructionPlaybackFixes.css";',
  ];
  const viewerMarkers = [
    "workspaceTimeSourceRef?: { readonly current: number };",
    "workspaceTimeSourceRef?.current ??",
    "Math.min(0.05, Math.max(0, (now - previous) / 1000))",
  ];

  for (const marker of editorMarkers) {
    if (!editor.includes(marker)) fail(`Editor validation failed for marker: ${marker}`);
  }
  for (const marker of viewerMarkers) {
    if (!viewer.includes(marker)) fail(`3D viewer validation failed for marker: ${marker}`);
  }

  await mkdir(dirname(targetCssPath), { recursive: true });
  await Promise.all([
    writeFile(editorPath, editor, "utf8"),
    writeFile(viewerPath, viewer, "utf8"),
    copyFile(packagedCssPath, targetCssPath),
  ]);

  console.log("\nRoadSafe reconstruction update applied successfully.\n");
  console.log("Changed:");
  console.log("- src/components/reconstruction/AccidentReconstructionEditor.tsx");
  console.log("- src/components/reconstruction/Reconstruction3DViewer.tsx");
  console.log("- src/components/reconstruction/reconstructionPlaybackFixes.css");
  console.log(`\nBackups: ${backupRoot}`);
  console.log("\nKeep npm run dev running, then refresh the reconstruction page.\n");
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
