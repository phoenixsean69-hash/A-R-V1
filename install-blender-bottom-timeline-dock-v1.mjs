import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const packagePath = path.join(root, "package.json");
const editorPath = path.join(
  root,
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
);
const colourGuardPath = path.join(
  root,
  "src/styles/blenderColorGuard.css",
);
const cssPayloadPath = path.join(
  scriptDir,
  "blender-bottom-timeline-dock-v1.css",
);

const backupRoot = path.join(root, ".roadsafe-ui-backup");
const statePath = path.join(
  backupRoot,
  "last-blender-bottom-timeline-dock-v1.json",
);

const CSS_START =
  "/* [RoadSafe:BlenderBottomTimelineDockV1:start] */";
const CSS_END =
  "/* [RoadSafe:BlenderBottomTimelineDockV1:end] */";

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(packagePath)) {
  fail(
    "Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1",
  );
}

const pkg = JSON.parse(
  fs.readFileSync(packagePath, "utf8"),
);

if (pkg.name !== "roadsafe-ar") {
  fail(
    `Expected package "roadsafe-ar", found "${pkg.name ?? "unknown"}".`,
  );
}

for (const requiredPath of [
  editorPath,
  colourGuardPath,
  cssPayloadPath,
]) {
  if (!fs.existsSync(requiredPath)) {
    fail(`Required file missing: ${requiredPath}`);
  }
}

fs.mkdirSync(backupRoot, { recursive: true });

const originalEditor =
  fs.readFileSync(editorPath, "utf8");

const originalColourGuard =
  fs.readFileSync(colourGuardPath, "utf8");

let editor = originalEditor;
let colourGuard = originalColourGuard;

/* ------------------------------------------------------------------ */
/* Idempotence check.                                                  */
/* ------------------------------------------------------------------ */

if (
  editor.includes(
    "reconstruction-workspace__timeline-dock",
  )
) {
  fail(
    "A Blender bottom timeline dock is already installed. No files changed.",
  );
}

/* ------------------------------------------------------------------ */
/* State.                                                              */
/* ------------------------------------------------------------------ */

const playbackSpeedAnchor =
  "  const [playbackSpeed, setPlaybackSpeed] = useState(1);";

if (
  !editor.includes(
    "const [timelineDockHeight, setTimelineDockHeight]",
  )
) {
  if (!editor.includes(playbackSpeedAnchor)) {
    fail(
      "Could not locate playbackSpeed state. No files changed.",
    );
  }

  editor = editor.replace(
    playbackSpeedAnchor,
`${playbackSpeedAnchor}
  const [timelineDockHeight, setTimelineDockHeight] = useState(220);
  const [timelineDockCollapsed, setTimelineDockCollapsed] = useState(false);`,
  );
}

/* ------------------------------------------------------------------ */
/* Resizer handler.                                                    */
/* ------------------------------------------------------------------ */

const durationHandlerAnchor =
  "  const handleDurationChange = (durationSeconds: number) => {";

if (
  !editor.includes(
    "const handleTimelineDockResizePointerDown",
  )
) {
  if (!editor.includes(durationHandlerAnchor)) {
    fail(
      "Could not locate duration handler anchor. No files changed.",
    );
  }

  const handler =
`  const handleTimelineDockResizePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (timelineDockCollapsed) return;

    event.preventDefault();
    event.stopPropagation();

    const startY = event.clientY;
    const startHeight = timelineDockHeight;

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      const maximumHeight = Math.max(
        220,
        Math.min(520, window.innerHeight * 0.58),
      );

      setTimelineDockHeight(
        clamp(
          startHeight + (startY - pointerEvent.clientY),
          130,
          maximumHeight,
        ),
      );
    };

    const handlePointerUp = () => {
      window.removeEventListener(
        "pointermove",
        handlePointerMove,
      );

      window.removeEventListener(
        "pointerup",
        handlePointerUp,
      );
    };

    window.addEventListener(
      "pointermove",
      handlePointerMove,
    );

    window.addEventListener(
      "pointerup",
      handlePointerUp,
      { once: true },
    );
  };

`;

  editor = editor.replace(
    durationHandlerAnchor,
    `${handler}${durationHandlerAnchor}`,
  );
}

/* ------------------------------------------------------------------ */
/* Timeline tool opens the dock instead of scrolling down the page.    */
/* ------------------------------------------------------------------ */

const oldTimelineToolPattern =
  /if\s*\(\s*tool\s*===\s*"Timeline"\s*\)\s*\{[\s\S]*?document[\s\S]*?getElementById\(\s*"reconstruction-timeline-workspace"\s*\)[\s\S]*?scrollIntoView\([\s\S]*?\);[\s\S]*?return;\s*\}/m;

if (
  !editor.includes(
    'setTimelineDockCollapsed(false);',
  )
) {
  const match = editor.match(oldTimelineToolPattern);

  if (!match) {
    fail(
      "Could not locate the current Timeline tool behavior. No files changed.",
    );
  }

  editor = editor.replace(
    match[0],
`if (tool === "Timeline") {
      resetPlacementTools();
      setTimelineDockCollapsed(false);
      return;
    }`,
  );
}

/* ------------------------------------------------------------------ */
/* Create one primary editor area: viewport above, timeline below.     */
/* ------------------------------------------------------------------ */

const bodyAnchor =
  '      <div className="reconstruction-workspace__body">';

if (
  !editor.includes(
    'className="reconstruction-workspace__primary-editor"',
  )
) {
  if (!editor.includes(bodyAnchor)) {
    fail(
      "Could not locate reconstruction workspace body. No files changed.",
    );
  }

  editor = editor.replace(
    bodyAnchor,
`${bodyAnchor}
        <div className="reconstruction-workspace__primary-editor">
          <div className="reconstruction-workspace__viewport-region">`,
  );
}

/* ------------------------------------------------------------------ */
/* Wrap the REAL existing playback + AccidentTimeline in the dock.     */
/* ------------------------------------------------------------------ */

const playbackAnchor =
  '<section className="reconstruction-playback" aria-label="Reconstruction playback controls">';

const playbackIndex =
  editor.indexOf(playbackAnchor);

if (playbackIndex < 0) {
  fail(
    "Could not locate reconstruction playback controls. No files changed.",
  );
}

const nodeEditorToken =
  "<ReconstructionNodeEditor";

const nodeEditorIndex =
  editor.indexOf(
    nodeEditorToken,
    playbackIndex,
  );

if (nodeEditorIndex < 0) {
  fail(
    "Could not locate ReconstructionNodeEditor after timeline. No files changed.",
  );
}

const timelineWorkspaceIndex =
  editor.indexOf(
    'id="reconstruction-timeline-workspace"',
    playbackIndex,
  );

if (
  timelineWorkspaceIndex < 0 ||
  timelineWorkspaceIndex > nodeEditorIndex
) {
  fail(
    "Could not locate the shared AccidentTimeline workspace between playback and nodes. No files changed.",
  );
}

const timelineWrapperClose =
  editor.lastIndexOf(
    "</div>",
    nodeEditorIndex,
  );

if (
  timelineWrapperClose < timelineWorkspaceIndex
) {
  fail(
    "Could not isolate the end of the timeline workspace. No files changed.",
  );
}

/*
 * Insert:
 * - close viewport region
 * - independent timeline dock
 * - dock bar
 * - dock content
 *
 * The EXISTING playback and AccidentTimeline markup remains unchanged inside.
 */
const dockStart =
`          </div>

          <section
            className={\`reconstruction-workspace__timeline-dock \${
              timelineDockCollapsed ? "is-collapsed" : ""
            }\`}
            style={{
              height: timelineDockCollapsed
                ? 29
                : timelineDockHeight,
            }}
            aria-label="Docked reconstruction timeline"
          >
            <div
              className="reconstruction-workspace__timeline-dock-resizer"
              role="separator"
              aria-label="Resize timeline panel"
              aria-orientation="horizontal"
              onPointerDown={handleTimelineDockResizePointerDown}
            />

            <header className="reconstruction-workspace__timeline-dock-bar">
              <div className="reconstruction-workspace__timeline-dock-title">
                <ScanLine size={13} />
                <strong>Timeline</strong>
                <small>Shared 2D / 3D accident sequence</small>
              </div>

              <div className="reconstruction-workspace__timeline-dock-tools">
                <span className="reconstruction-workspace__timeline-dock-clock">
                  {currentTime.toFixed(2)}s
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setTimelineDockCollapsed(
                      (current) => !current,
                    )
                  }
                  aria-label={
                    timelineDockCollapsed
                      ? "Expand timeline panel"
                      : "Collapse timeline panel"
                  }
                  title={
                    timelineDockCollapsed
                      ? "Expand timeline"
                      : "Collapse timeline"
                  }
                >
                  <ChevronUp size={13} />
                </button>
              </div>
            </header>

            <div className="reconstruction-workspace__timeline-dock-content">
`;

editor =
  editor.slice(0, playbackIndex) +
  dockStart +
  editor.slice(playbackIndex);

/*
 * The earlier insertion shifts all later indexes, so re-find the node editor.
 */
const shiftedNodeIndex =
  editor.indexOf(
    nodeEditorToken,
    playbackIndex + dockStart.length,
  );

if (shiftedNodeIndex < 0) {
  fail(
    "Could not re-locate ReconstructionNodeEditor after dock insertion. No files changed.",
  );
}

const shiftedTimelineClose =
  editor.lastIndexOf(
    "</div>",
    shiftedNodeIndex,
  );

if (shiftedTimelineClose < 0) {
  fail(
    "Could not re-locate timeline wrapper close after dock insertion. No files changed.",
  );
}

const timelineCloseEnd =
  shiftedTimelineClose +
  "</div>".length;

const dockEnd =
`
            </div>
          </section>
        </div>
`;

editor =
  editor.slice(0, timelineCloseEnd) +
  dockEnd +
  editor.slice(timelineCloseEnd);

/* ------------------------------------------------------------------ */
/* CSS payload.                                                        */
/* ------------------------------------------------------------------ */

const oldCssStart =
  colourGuard.indexOf(CSS_START);

if (oldCssStart >= 0) {
  const oldCssEnd =
    colourGuard.indexOf(
      CSS_END,
      oldCssStart,
    );

  if (oldCssEnd < 0) {
    fail(
      "Found incomplete previous timeline-dock CSS markers. No files changed.",
    );
  }

  colourGuard =
    colourGuard.slice(0, oldCssStart) +
    colourGuard.slice(
      oldCssEnd + CSS_END.length,
    );
}

const cssPayload =
  fs.readFileSync(
    cssPayloadPath,
    "utf8",
  ).trim();

if (
  !cssPayload.startsWith(CSS_START) ||
  !cssPayload.endsWith(CSS_END)
) {
  fail(
    "Timeline dock CSS payload markers are invalid. No files changed.",
  );
}

const opens =
  (cssPayload.match(/\{/g) ?? []).length;
const closes =
  (cssPayload.match(/\}/g) ?? []).length;

if (opens !== closes) {
  fail(
    `Timeline dock CSS brace mismatch: ${opens} opening / ${closes} closing.`,
  );
}

colourGuard =
  `${colourGuard.trimEnd()}\n\n${cssPayload}\n`;

/* ------------------------------------------------------------------ */
/* Structural verification.                                           */
/* ------------------------------------------------------------------ */

const requiredEditorTokens = [
  "timelineDockHeight",
  "timelineDockCollapsed",
  "handleTimelineDockResizePointerDown",
  "reconstruction-workspace__primary-editor",
  "reconstruction-workspace__viewport-region",
  "reconstruction-workspace__timeline-dock",
  "reconstruction-workspace__timeline-dock-resizer",
  "reconstruction-workspace__timeline-dock-content",
  'id="reconstruction-timeline-workspace"',
  "<AccidentTimeline",
  "<ReconstructionNodeEditor",
];

for (const token of requiredEditorTokens) {
  if (!editor.includes(token)) {
    fail(
      `Timeline dock structural guard failed: ${token}`,
    );
  }
}

/*
 * There must still be exactly ONE AccidentTimeline.
 */
const accidentTimelineCount =
  (editor.match(/<AccidentTimeline\b/g) ?? []).length;

if (accidentTimelineCount !== 1) {
  fail(
    `Expected one shared AccidentTimeline, found ${accidentTimelineCount}. No files changed.`,
  );
}

/* ------------------------------------------------------------------ */
/* Parse the COMPLETE transformed TSX before writing.                  */
/* ------------------------------------------------------------------ */

try {
  const require = createRequire(import.meta.url);
  const ts = require("typescript");

  const sourceFile =
    ts.createSourceFile(
      "AccidentReconstructionEditor.tsx",
      editor,
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
            typeof diagnostic.start !== "number"
          ) {
            return message;
          }

          const location =
            sourceFile.getLineAndCharacterOfPosition(
              diagnostic.start,
            );

          return (
            `line ${location.line + 1}, ` +
            `column ${location.character + 1}: ` +
            message
          );
        })
        .join("\n");

    fail(
      `Transformed timeline-dock TSX parse audit failed:\n${details}`,
    );
  }

  console.log(
    "Timeline dock TSX parse audit: PASS",
  );
} catch (error) {
  if (
    String(error).includes(
      "Cannot find module 'typescript'",
    )
  ) {
    console.warn(
      "TypeScript parser unavailable; structural guards still passed.",
    );
  } else {
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Backup + write.                                                     */
/* ------------------------------------------------------------------ */

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
      originalEditor,
      originalColourGuard,
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
  colourGuardPath,
  colourGuard,
  "utf8",
);

console.log("");
console.log(
  "RoadSafe Blender bottom Timeline Dock V1 installed.",
);
console.log("");
console.log(
  "The SAME synchronized timeline is now:",
);
console.log(
  "- docked at the bottom in 2D;",
);
console.log(
  "- docked at the bottom in 3D;",
);
console.log(
  "- independent from the active viewport;",
);
console.log(
  "- vertically resizable from its top divider;",
);
console.log(
  "- collapsible from its editor header.",
);
console.log("");
console.log("Start / refresh:");
console.log("  npm run dev");
console.log("");
console.log("Recommended verification:");
console.log("  npm run build");
console.log("");
console.log("Rollback:");
console.log(
  "  node revoke-blender-bottom-timeline-dock-v1.mjs",
);
