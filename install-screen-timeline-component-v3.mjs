import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const scriptDir =
  path.dirname(
    fileURLToPath(import.meta.url),
  );

const packagePath =
  path.join(root, "package.json");

const editorPath =
  path.join(
    root,
    "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  );

const colourGuardPath =
  path.join(
    root,
    "src/styles/blenderColorGuard.css",
  );

const componentPath =
  path.join(
    root,
    "src/components/reconstruction/ReconstructionTimelineDock.tsx",
  );

const cssPath =
  path.join(
    root,
    "src/components/reconstruction/reconstructionTimelineDock.css",
  );

const payloadComponentPath =
  path.join(
    scriptDir,
    "ReconstructionTimelineDock.tsx",
  );

const payloadCssPath =
  path.join(
    scriptDir,
    "reconstructionTimelineDock.css",
  );

const backupRoot =
  path.join(
    root,
    ".roadsafe-ui-backup",
  );

const v1StatePath =
  path.join(
    backupRoot,
    "last-blender-bottom-timeline-dock-v1.json",
  );

const v2StatePath =
  path.join(
    backupRoot,
    "last-blender-bottom-timeline-dock-v2.json",
  );

const statePath =
  path.join(
    backupRoot,
    "last-screen-timeline-component-v3.json",
  );

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(packagePath)) {
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

if (pkg.name !== "roadsafe-ar") {
  fail(
    `Expected package "roadsafe-ar", found "${pkg.name ?? "unknown"}".`,
  );
}

for (
  const requiredPath of [
    editorPath,
    colourGuardPath,
    payloadComponentPath,
    payloadCssPath,
  ]
) {
  if (!fs.existsSync(requiredPath)) {
    fail(
      `Required file missing: ${requiredPath}`,
    );
  }
}

fs.mkdirSync(
  backupRoot,
  { recursive: true },
);

/*
 * --------------------------------------------------------------------------
 * 1. Unwind the two incorrect inline-dock attempts automatically.
 * --------------------------------------------------------------------------
 *
 * V2's backup restores V1.
 * V1's backup restores the clean pre-timeline workspace.
 *
 * This DOES NOT touch the earlier Blender Properties work because V1 was
 * installed after those changes.
 */

function restoreTimelineInstallerState(
  stateFile,
  label,
) {
  if (!fs.existsSync(stateFile)) {
    return;
  }

  const state =
    JSON.parse(
      fs.readFileSync(
        stateFile,
        "utf8",
      ),
    );

  if (
    state.editorPath &&
    typeof state.originalEditor ===
      "string"
  ) {
    fs.writeFileSync(
      path.join(
        root,
        state.editorPath,
      ),
      state.originalEditor,
      "utf8",
    );
  }

  if (
    state.colourGuardPath &&
    typeof state.originalColourGuard ===
      "string"
  ) {
    fs.writeFileSync(
      path.join(
        root,
        state.colourGuardPath,
      ),
      state.originalColourGuard,
      "utf8",
    );
  }

  fs.rmSync(
    stateFile,
    { force: true },
  );

  console.log(
    `UNWOUND ${label}.`,
  );
}

restoreTimelineInstallerState(
  v2StatePath,
  "incorrect Timeline Dock V2",
);

restoreTimelineInstallerState(
  v1StatePath,
  "incorrect Timeline Dock V1",
);

const originalEditor =
  fs.readFileSync(
    editorPath,
    "utf8",
  );

const originalColourGuard =
  fs.readFileSync(
    colourGuardPath,
    "utf8",
  );

const originalComponent =
  fs.existsSync(componentPath)
    ? fs.readFileSync(
        componentPath,
        "utf8",
      )
    : null;

const originalCss =
  fs.existsSync(cssPath)
    ? fs.readFileSync(
        cssPath,
        "utf8",
      )
    : null;

function restoreV3() {
  fs.writeFileSync(
    editorPath,
    originalEditor,
    "utf8",
  );

  fs.writeFileSync(
    colourGuardPath,
    originalColourGuard,
    "utf8",
  );

  if (originalComponent === null) {
    fs.rmSync(
      componentPath,
      { force: true },
    );
  } else {
    fs.writeFileSync(
      componentPath,
      originalComponent,
      "utf8",
    );
  }

  if (originalCss === null) {
    fs.rmSync(
      cssPath,
      { force: true },
    );
  } else {
    fs.writeFileSync(
      cssPath,
      originalCss,
      "utf8",
    );
  }

  console.log(
    "RESTORED clean pre-V3 timeline state.",
  );
}

let editor =
  originalEditor;

/*
 * --------------------------------------------------------------------------
 * 2. Import the NEW screen-level component.
 * --------------------------------------------------------------------------
 */

const oldTimelineImport =
  'import AccidentTimeline from "./AccidentTimeline";';

const newDockImport =
  'import ReconstructionTimelineDock from "./ReconstructionTimelineDock";';

if (
  !editor.includes(
    newDockImport,
  )
) {
  if (
    editor.includes(
      oldTimelineImport,
    )
  ) {
    editor =
      editor.replace(
        oldTimelineImport,
        newDockImport,
      );
  } else {
    const nodeImport =
      'import ReconstructionNodeEditor from "./ReconstructionNodeEditor";';

    if (!editor.includes(nodeImport)) {
      fail(
        "Could not locate reconstruction component import area. No V3 files written.",
      );
    }

    editor =
      editor.replace(
        nodeImport,
        `${newDockImport}\n${nodeImport}`,
      );
  }
}

/*
 * --------------------------------------------------------------------------
 * 3. REMOVE the old inline playback + timeline from body flow.
 * --------------------------------------------------------------------------
 */

const playbackStartToken =
  '<section className="reconstruction-playback" aria-label="Reconstruction playback controls">';

const nodeEditorToken =
  "<ReconstructionNodeEditor";

const playbackStart =
  editor.indexOf(
    playbackStartToken,
  );

const nodeStart =
  editor.indexOf(
    nodeEditorToken,
    playbackStart >= 0
      ? playbackStart
      : 0,
  );

if (
  playbackStart < 0 ||
  nodeStart < 0 ||
  nodeStart <= playbackStart
) {
  fail(
    "Could not isolate the old inline playback/timeline block. No V3 files written.",
  );
}

const removedBlock =
  editor.slice(
    playbackStart,
    nodeStart,
  );

if (
  !removedBlock.includes(
    "<AccidentTimeline",
  ) ||
  !removedBlock.includes(
    'id="reconstruction-timeline-workspace"',
  )
) {
  fail(
    "The isolated block did not contain the expected old Timeline. No V3 files written.",
  );
}

editor =
  editor.slice(0, playbackStart) +
  editor.slice(nodeStart);

console.log(
  "REMOVED old inline playback/timeline from page flow.",
);

/*
 * --------------------------------------------------------------------------
 * 4. Timeline toolbar button now opens the independent component.
 * --------------------------------------------------------------------------
 */

const oldTimelineToolRegex =
  /if\s*\(\s*tool\s*===\s*"Timeline"\s*\)\s*\{[\s\S]*?document[\s\S]*?getElementById\(\s*"reconstruction-timeline-workspace"\s*\)[\s\S]*?scrollIntoView\([\s\S]*?\);[\s\S]*?return;\s*\}/m;

const oldTimelineToolMatch =
  editor.match(
    oldTimelineToolRegex,
  );

if (oldTimelineToolMatch) {
  editor =
    editor.replace(
      oldTimelineToolMatch[0],
`if (tool === "Timeline") {
      resetPlacementTools();

      window.dispatchEvent(
        new Event(
          "roadsafe:timeline-open",
        ),
      );

      return;
    }`,
    );
} else if (
  !editor.includes(
    '"roadsafe:timeline-open"',
  )
) {
  fail(
    "Could not locate Timeline toolbar behavior. No V3 files written.",
  );
}

editor =
  editor.replaceAll(
    "Jumps to the synchronized event timeline below the map.",
    "Opens the synchronized screen Timeline editor.",
  );

editor =
  editor.replaceAll(
    "Jumps to the synchronized event timeline below the 3D scene.",
    "Opens the synchronized screen Timeline editor.",
  );

/*
 * --------------------------------------------------------------------------
 * 5. Mount the NEW component as a sibling AFTER body — not inside body.
 * --------------------------------------------------------------------------
 */

const dockUsage =
`      <ReconstructionTimelineDock
        reconstruction={reconstruction}
        currentTime={currentTime}
        isPlaying={isPlaying}
        playbackSpeed={playbackSpeed}
        onReset={handleReset}
        onPlayPause={handlePlayPause}
        onStepBackward={() => {
          setIsPlaying(false);

          setCurrentTime(
            (time) =>
              Math.max(
                0,
                time - 0.1,
              ),
          );
        }}
        onStepForward={() => {
          setIsPlaying(false);

          setCurrentTime(
            (time) =>
              Math.min(
                reconstruction.durationSeconds,
                time + 0.1,
              ),
          );
        }}
        onSeek={(time) => {
          setIsPlaying(false);
          setCurrentTime(time);
        }}
        onPlaybackSpeedChange={
          setPlaybackSpeed
        }
        onEventsChange={(timelineEvents) =>
          setReconstruction(
            (current) => ({
              ...current,
              timelineEvents,
            }),
          )
        }
        onSelectParticipantPathPoint={(
          participantId,
          pointId,
        ) =>
          handleSelectParticipant(
            participantId,
            pointId,
          )
        }
        onSelectSceneObject={
          handleSelectSceneObject
        }
      />
`;

if (
  !editor.includes(
    "<ReconstructionTimelineDock",
  )
) {
  /*
   * Root return ends:
   *
   *       </div>  // body
   *     </div>    // reconstruction root
   *   );
   * }
   *
   * Insert the independent dock between body close and root close.
   */
  const rootCloseToken =
    "\n    </div>\n  );\n}";

  const rootCloseIndex =
    editor.lastIndexOf(
      rootCloseToken,
    );

  if (rootCloseIndex < 0) {
    fail(
      "Could not locate reconstruction root close. No V3 files written.",
    );
  }

  editor =
    editor.slice(
      0,
      rootCloseIndex,
    ) +
    `\n${dockUsage}` +
    editor.slice(
      rootCloseIndex,
    );
}

/*
 * --------------------------------------------------------------------------
 * 6. Remove playback icon imports that became unused.
 * --------------------------------------------------------------------------
 */

function removeIconImportIfUnused(
  source,
  icon,
) {
  const usageCount =
    (
      source.match(
        new RegExp(
          `\\b${icon}\\b`,
          "g",
        ),
      ) ?? []
    ).length;

  /*
   * Exactly one occurrence means the icon exists only in the import list.
   */
  if (usageCount !== 1) {
    return source;
  }

  return source.replace(
    new RegExp(
      `^[\\t ]*${icon},[\\t ]*\\r?\\n`,
      "m",
    ),
    "",
  );
}

for (
  const icon of [
    "Pause",
    "Play",
    "RotateCcw",
    "SkipBack",
    "SkipForward",
  ]
) {
  editor =
    removeIconImportIfUnused(
      editor,
      icon,
    );
}

/*
 * --------------------------------------------------------------------------
 * 7. Structural guards.
 * --------------------------------------------------------------------------
 */

const requiredEditorTokens = [
  'import ReconstructionTimelineDock from "./ReconstructionTimelineDock";',
  "<ReconstructionTimelineDock",
  '"roadsafe:timeline-open"',
  "<ReconstructionNodeEditor",
  "reconstruction-workspace__body",
];

for (const token of requiredEditorTokens) {
  if (!editor.includes(token)) {
    fail(
      `V3 editor guard failed: ${token}`,
    );
  }
}

if (
  editor.includes(
    playbackStartToken,
  )
) {
  fail(
    "Old inline playback UI is still present after V3 extraction.",
  );
}

if (
  editor.includes(
    "<AccidentTimeline",
  )
) {
  fail(
    "AccidentTimeline is still rendered directly inside AccidentReconstructionEditor.",
  );
}

const dockCount =
  (
    editor.match(
      /<ReconstructionTimelineDock\b/g,
    ) ?? []
  ).length;

if (dockCount !== 1) {
  fail(
    `Expected exactly one screen Timeline dock, found ${dockCount}.`,
  );
}

/*
 * --------------------------------------------------------------------------
 * 8. Parse transformed TSX + new component BEFORE writing.
 * --------------------------------------------------------------------------
 */

const component =
  fs.readFileSync(
    payloadComponentPath,
    "utf8",
  );

try {
  const require =
    createRequire(
      import.meta.url,
    );

  const ts =
    require("typescript");

  const parse = (
    name,
    content,
  ) => {
    const sourceFile =
      ts.createSourceFile(
        name,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );

    const diagnostics =
      sourceFile.parseDiagnostics ?? [];

    if (diagnostics.length > 0) {
      const details =
        diagnostics
          .slice(0, 12)
          .map((diagnostic) => {
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

            const location =
              sourceFile.getLineAndCharacterOfPosition(
                diagnostic.start,
              );

            return (
              `${name}:` +
              `${location.line + 1}:` +
              `${location.character + 1} ` +
              message
            );
          })
          .join("\n");

      fail(
        `TSX parse audit failed:\n${details}`,
      );
    }
  };

  parse(
    "AccidentReconstructionEditor.tsx",
    editor,
  );

  parse(
    "ReconstructionTimelineDock.tsx",
    component,
  );

  console.log(
    "V3 editor + component TSX parse audit: PASS",
  );
} catch (error) {
  if (
    String(error).includes(
      "Cannot find module 'typescript'",
    )
  ) {
    console.warn(
      "TypeScript parser unavailable; structural guards passed.",
    );
  } else {
    throw error;
  }
}

/*
 * --------------------------------------------------------------------------
 * 9. Backup CLEAN pre-V3 state + write.
 * --------------------------------------------------------------------------
 */

fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      installedAt:
        new Date().toISOString(),

      editorPath:
        path.relative(
          root,
          editorPath,
        ),

      colourGuardPath:
        path.relative(
          root,
          colourGuardPath,
        ),

      componentPath:
        path.relative(
          root,
          componentPath,
        ),

      cssPath:
        path.relative(
          root,
          cssPath,
        ),

      originalEditor,
      originalColourGuard,
      originalComponent,
      originalCss,
    },
    null,
    2,
  ),
  "utf8",
);

fs.writeFileSync(
  editorPath,
  editor,
  "utf8",
);

fs.writeFileSync(
  componentPath,
  component,
  "utf8",
);

fs.writeFileSync(
  cssPath,
  fs.readFileSync(
    payloadCssPath,
    "utf8",
  ),
  "utf8",
);

console.log("");
console.log(
  "SCREEN TIMELINE COMPONENT WRITTEN.",
);
console.log("");
console.log(
  "Running full build...",
);

const build =
  spawnSync(
    process.platform === "win32"
      ? "npm.cmd"
      : "npm",
    ["run", "build"],
    {
      cwd: root,
      stdio: "inherit",
      shell: false,
    },
  );

if (build.status !== 0) {
  console.error("");
  console.error(
    "Build failed. Restoring clean pre-V3 timeline state...",
  );

  restoreV3();

  fs.rmSync(
    statePath,
    { force: true },
  );

  process.exit(
    build.status ?? 1,
  );
}

console.log("");
console.log(
  "RoadSafe Screen Timeline Component V3 installed successfully.",
);
console.log("");
console.log(
  "Architecture:",
);
console.log(
  "  ReconstructionTimelineDock.tsx = independent screen component",
);
console.log(
  "  AccidentReconstructionEditor.tsx = no inline Timeline",
);
console.log(
  "  centre workspace + right Properties stop above dock",
);
console.log(
  "  Nodes / panels scroll independently above it",
);
console.log(
  "  same canonical AccidentTimeline drives 2D + 3D",
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
  "Rollback V3:",
);
console.log(
  "  node revoke-screen-timeline-component-v3.mjs",
);
