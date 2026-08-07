import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const root = process.cwd();

const packagePath =
  path.join(
    root,
    "package.json",
  );

const editorPath =
  path.join(
    root,
    "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  );

const cssPath =
  path.join(
    root,
    "src/components/reconstruction/reconstructionBottomDock.css",
  );

const backupRoot =
  path.join(
    root,
    ".roadsafe-ui-backup",
  );

const statePath =
  path.join(
    backupRoot,
    "last-blender-viewport-toolbar-shortcuts-v1.json",
  );

const buildLogPath =
  path.join(
    backupRoot,
    "blender-viewport-toolbar-shortcuts-v1-build.log",
  );

const CSS_START =
  "/* [RoadSafe:BlenderViewportToolbarShortcutsV1:start] */";

const CSS_END =
  "/* [RoadSafe:BlenderViewportToolbarShortcutsV1:end] */";

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

if (
  pkg.name !==
  "roadsafe-ar"
) {
  fail(
    `Expected package "roadsafe-ar", found "${pkg.name ?? "unknown"}".`,
  );
}

for (
  const required of [
    editorPath,
    cssPath,
  ]
) {
  if (!fs.existsSync(required)) {
    fail(
      `Required file missing: ${required}`,
    );
  }
}

const originalEditor =
  fs.readFileSync(
    editorPath,
    "utf8",
  );

const originalCss =
  fs.readFileSync(
    cssPath,
    "utf8",
  );

let editor =
  originalEditor;

let css =
  originalCss;

/* ========================================================================== */
/* State: toolbar visibility + shortcut sheet                                 */
/* ========================================================================== */

if (
  !editor.includes(
    "workspaceToolbarVisible",
  )
) {
  const statePattern =
    /(\s*const\s+\[activeWorkspaceTool,\s*setActiveWorkspaceTool\]\s*=\s*[\r\n\s]*useState<WorkspaceTool>\("Select"\);)/m;

  const stateMatch =
    editor.match(
      statePattern,
    );

  if (!stateMatch) {
    fail(
      "Could not locate activeWorkspaceTool state structurally.",
    );
  }

  editor =
    editor.replace(
      stateMatch[0],
`${stateMatch[0]}
  const [workspaceToolbarVisible, setWorkspaceToolbarVisible] =
    useState(true);
  const [shortcutHelpVisible, setShortcutHelpVisible] =
    useState(false);`,
    );
}

/* ========================================================================== */
/* Tool metadata: same real workspace tools, plus Blender-style shortcuts.    */
/* ========================================================================== */

const toolsStart =
  editor.indexOf(
    "  const workspaceTools:",
  );

const guidanceStart =
  editor.indexOf(
    "  const workspaceToolGuidance:",
    toolsStart,
  );

if (
  toolsStart < 0 ||
  guidanceStart < 0
) {
  fail(
    "Could not isolate workspaceTools metadata.",
  );
}

const newTools =
`  const workspaceTools: Array<{
    label: WorkspaceTool;
    icon: typeof Crosshair;
    shortcut: string;
  }> = [
    { label: "Select", icon: Crosshair, shortcut: "W" },
    { label: "Move", icon: Move, shortcut: "G" },
    { label: "Rotate", icon: RotateCw, shortcut: "R" },
    { label: "Scale", icon: Expand, shortcut: "S" },
    { label: "Timeline", icon: ScanLine, shortcut: "⇧T" },
    { label: "Measure", icon: Ruler, shortcut: "M" },
    { label: "Camera", icon: Camera, shortcut: "C" },
  ];

`;

editor =
  editor.slice(
    0,
    toolsStart,
  ) +
  newTools +
  editor.slice(
    guidanceStart,
  );

/* ========================================================================== */
/* Replace persistent large rail/hint renderer with Blender icon toolbar.     */
/* Also install keyboard shortcuts using the EXISTING command handlers.        */
/* ========================================================================== */

const activeGuidanceStart =
  editor.indexOf(
    "  const activeToolGuidance =",
  );

const nextFunctionStart =
  editor.indexOf(
    "  const handleLoadScenario =",
    activeGuidanceStart,
  );

if (
  activeGuidanceStart < 0 ||
  nextFunctionStart < 0
) {
  fail(
    "Could not isolate existing workspace toolbar renderer.",
  );
}

const newToolbar =
`  useEffect(() => {
    const handleViewportShortcut = (
      event: KeyboardEvent,
    ) => {
      if (
        event.defaultPrevented ||
        event.repeat
      ) {
        return;
      }

      if (
        activeInvestigationDetail ||
        fieldPlacementOpen
      ) {
        return;
      }

      const target =
        event.target as
          HTMLElement | null;

      if (
        target?.closest(
          "input, textarea, select, button, a, [contenteditable='true'], [role='textbox']",
        )
      ) {
        return;
      }

      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }

      const key =
        event.key.toLowerCase();

      if (
        event.shiftKey &&
        key === "t"
      ) {
        event.preventDefault();
        handleWorkspaceTool(
          "Timeline",
        );
        return;
      }

      if (
        event.key === "?"
      ) {
        event.preventDefault();
        setShortcutHelpVisible(
          (current) => !current,
        );
        return;
      }

      if (
        event.code === "Space"
      ) {
        event.preventDefault();
        handlePlayPause();
        return;
      }

      switch (key) {
        case "t":
          event.preventDefault();
          setWorkspaceToolbarVisible(
            (current) => !current,
          );
          return;

        case "n":
          event.preventDefault();

          if (
            workspaceSettingsOpen
          ) {
            setWorkspaceSettingsOpen(
              false,
            );
          } else {
            setWorkspacePropertiesOpen(
              (current) => !current,
            );
          }

          return;

        case "w":
          event.preventDefault();
          handleWorkspaceTool(
            "Select",
          );
          return;

        case "g":
          event.preventDefault();
          handleWorkspaceTool(
            "Move",
          );
          return;

        case "r":
          event.preventDefault();
          handleWorkspaceTool(
            "Rotate",
          );
          return;

        case "s":
          event.preventDefault();
          handleWorkspaceTool(
            "Scale",
          );
          return;

        case "m":
          event.preventDefault();
          handleWorkspaceTool(
            "Measure",
          );
          return;

        case "c":
          event.preventDefault();
          handleWorkspaceTool(
            "Camera",
          );
          return;

        case "1":
          event.preventDefault();
          setIsPlaying(
            false,
          );
          setActiveReconstructionView(
            "2D",
          );
          return;

        case "3":
          event.preventDefault();
          setIsPlaying(
            false,
          );
          setActiveReconstructionView(
            "3D",
          );
          return;

        case "home":
          if (
            activeReconstructionView ===
            "2D"
          ) {
            event.preventDefault();
            setSceneView({
              zoom:
                MIN_SCENE_ZOOM,
              panX: 0,
              panY: 0,
            });
          }

          return;

        default:
          return;
      }
    };

    window.addEventListener(
      "keydown",
      handleViewportShortcut,
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleViewportShortcut,
      );
  }, [
    activeInvestigationDetail,
    activeReconstructionView,
    fieldPlacementOpen,
    handlePlayPause,
    workspaceSettingsOpen,
  ]);

  const renderWorkspaceTools = () => (
    <>
      {workspaceToolbarVisible && (
        <nav
          className="reconstruction-workspace__tools reconstruction-workspace__blender-toolbar"
          aria-label="Viewport tools"
          data-scene-interactive="true"
        >
          {workspaceTools.map(
            ({
              label,
              icon: Icon,
              shortcut,
            }) => {
              const guidance =
                workspaceToolGuidance[
                  label
                ];

              return (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    handleWorkspaceTool(
                      label,
                    )
                  }
                  className={
                    activeWorkspaceTool ===
                    label
                      ? "is-active"
                      : ""
                  }
                  aria-label={\`\${label} tool (\${shortcut})\`}
                  aria-pressed={
                    activeWorkspaceTool ===
                    label
                  }
                  data-tool={
                    label
                  }
                >
                  <Icon
                    size={17}
                    strokeWidth={1.8}
                  />

                  <span className="reconstruction-workspace__blender-tool-tooltip">
                    <span className="reconstruction-workspace__blender-tool-tooltip-title">
                      <strong>
                        {guidance.title}
                      </strong>

                      <kbd>
                        {shortcut}
                      </kbd>
                    </span>

                    <small>
                      {activeReconstructionView ===
                      "2D"
                        ? guidance.twoD
                        : guidance.threeD}
                    </small>
                  </span>
                </button>
              );
            },
          )}
        </nav>
      )}

      {shortcutHelpVisible && (
        <aside
          className="reconstruction-workspace__shortcut-sheet"
          data-scene-interactive="true"
          aria-label="Reconstruction keyboard shortcuts"
        >
          <header>
            <div>
              <span>
                Viewport
              </span>
              <strong>
                Keyboard Shortcuts
              </strong>
            </div>

            <button
              type="button"
              onClick={() =>
                setShortcutHelpVisible(
                  false,
                )
              }
              aria-label="Close keyboard shortcuts"
            >
              ×
            </button>
          </header>

          <div className="reconstruction-workspace__shortcut-groups">
            <section>
              <strong>
                Tools
              </strong>

              <div>
                <span>
                  <kbd>W</kbd>
                  Select
                </span>
                <span>
                  <kbd>G</kbd>
                  Move / Grab
                </span>
                <span>
                  <kbd>R</kbd>
                  Rotate
                </span>
                <span>
                  <kbd>S</kbd>
                  Scale
                </span>
                <span>
                  <kbd>M</kbd>
                  Measure
                </span>
                <span>
                  <kbd>C</kbd>
                  Camera
                </span>
                <span>
                  <kbd>Shift</kbd>
                  <kbd>T</kbd>
                  Timeline
                </span>
              </div>
            </section>

            <section>
              <strong>
                Viewport
              </strong>

              <div>
                <span>
                  <kbd>T</kbd>
                  Toolbar
                </span>
                <span>
                  <kbd>N</kbd>
                  Properties
                </span>
                <span>
                  <kbd>1</kbd>
                  2D View
                </span>
                <span>
                  <kbd>3</kbd>
                  3D View
                </span>
                <span>
                  <kbd>Home</kbd>
                  Fit 2D
                </span>
                <span>
                  <kbd>?</kbd>
                  Shortcut sheet
                </span>
              </div>
            </section>

            <section>
              <strong>
                Playback & History
              </strong>

              <div>
                <span>
                  <kbd>Space</kbd>
                  Play / Pause
                </span>
                <span>
                  <kbd>Ctrl</kbd>
                  <kbd>Z</kbd>
                  Undo
                </span>
                <span>
                  <kbd>Ctrl</kbd>
                  <kbd>Shift</kbd>
                  <kbd>Z</kbd>
                  Redo
                </span>
              </div>
            </section>
          </div>
        </aside>
      )}
    </>
  );

`;

editor =
  editor.slice(
    0,
    activeGuidanceStart,
  ) +
  newToolbar +
  editor.slice(
    nextFunctionStart,
  );

/* The old always-visible SELECT AND INSPECT hint is deliberately removed. */
const hintCount =
  (
    editor.match(
      /\{renderWorkspaceToolHint\(\)\}/g,
    ) ?? []
  ).length;

if (
  hintCount < 2
) {
  fail(
    `Expected the old persistent tool hint in both 2D and 3D; found ${hintCount}.`,
  );
}

editor =
  editor.replace(
    /\s*\{renderWorkspaceToolHint\(\)\}/g,
    "",
  );

/* ========================================================================== */
/* CSS: Blender-like thin icon toolbar + hover flyout + shortcut sheet.       */
/* ========================================================================== */

const previousStart =
  css.indexOf(
    CSS_START,
  );

if (
  previousStart >= 0
) {
  const previousEnd =
    css.indexOf(
      CSS_END,
      previousStart,
    );

  if (
    previousEnd < 0
  ) {
    fail(
      "Found incomplete previous Blender viewport toolbar CSS block.",
    );
  }

  css =
    css.slice(
      0,
      previousStart,
    ) +
    css.slice(
      previousEnd +
        CSS_END.length,
    );
}

const cssPatch = `
${CSS_START}

/* ========================================================================== */
/* Blender-style viewport toolbar — shared by 2D and 3D.                     */
/* ========================================================================== */

.reconstruction-workspace
  .reconstruction-workspace__tools.reconstruction-workspace__blender-toolbar {
  position: absolute !important;

  z-index: 96 !important;

  top: 8px !important;
  left: 8px !important;

  width: 40px !important;
  min-width: 40px !important;

  display: flex !important;
  flex-direction: column !important;
  align-items: stretch !important;

  gap: 1px !important;

  padding: 2px !important;

  overflow: visible !important;

  border:
    1px solid #171717 !important;
  border-radius:
    2px !important;

  background:
    rgba(43, 43, 43, .97) !important;

  box-shadow:
    0 4px 12px rgba(0,0,0,.28),
    inset 0 1px 0 rgba(255,255,255,.025) !important;
}

.reconstruction-workspace
  .reconstruction-workspace__tools.reconstruction-workspace__blender-toolbar
  > button {
  position: relative !important;

  width: 34px !important;
  min-width: 34px !important;

  height: 34px !important;
  min-height: 34px !important;

  display: grid !important;
  place-items: center !important;

  padding: 0 !important;
  margin: 0 !important;

  border:
    1px solid transparent !important;
  border-left:
    2px solid transparent !important;
  border-radius:
    1px !important;

  background:
    transparent !important;

  color:
    #aaa !important;

  box-shadow:
    none !important;

  overflow: visible !important;
}

.reconstruction-workspace
  .reconstruction-workspace__tools.reconstruction-workspace__blender-toolbar
  > button:hover {
  border-color:
    #4b4b4b !important;

  background:
    #383838 !important;

  color:
    #f0f0f0 !important;
}

.reconstruction-workspace
  .reconstruction-workspace__tools.reconstruction-workspace__blender-toolbar
  > button.is-active {
  border-color:
    #494949 !important;

  border-left-color:
    #e8872d !important;

  background:
    #404040 !important;

  color:
    #fff !important;

  box-shadow:
    inset 2px 0 0 #e8872d !important;
}

/* Small Blender-like separators between transform and utility groups. */
.reconstruction-workspace
  .reconstruction-workspace__blender-toolbar
  > button[data-tool="Timeline"],
.reconstruction-workspace
  .reconstruction-workspace__blender-toolbar
  > button[data-tool="Camera"] {
  margin-top:
    5px !important;
}

.reconstruction-workspace
  .reconstruction-workspace__blender-toolbar
  > button[data-tool="Timeline"]::before,
.reconstruction-workspace
  .reconstruction-workspace__blender-toolbar
  > button[data-tool="Camera"]::before {
  content:
    "" !important;

  position:
    absolute !important;

  left:
    3px !important;
  right:
    3px !important;
  top:
    -4px !important;

  height:
    1px !important;

  background:
    #1a1a1a !important;
}

/* No static text. Details appear only as a Blender-style hover flyout. */
.reconstruction-workspace__blender-tool-tooltip {
  position:
    absolute !important;

  z-index:
    140 !important;

  left:
    calc(100% + 7px) !important;

  top:
    -1px !important;

  width:
    220px !important;

  display:
    flex !important;

  flex-direction:
    column !important;

  gap:
    4px !important;

  padding:
    7px 8px !important;

  border:
    1px solid #525252 !important;

  border-radius:
    2px !important;

  background:
    #222 !important;

  color:
    #cfcfcf !important;

  text-align:
    left !important;

  box-shadow:
    0 8px 22px rgba(0,0,0,.36) !important;

  opacity:
    0 !important;

  visibility:
    hidden !important;

  transform:
    translateX(-3px) !important;

  transition:
    opacity 90ms ease,
    transform 90ms ease,
    visibility 90ms ease !important;

  pointer-events:
    none !important;
}

.reconstruction-workspace__blender-toolbar
  > button:hover
  .reconstruction-workspace__blender-tool-tooltip,
.reconstruction-workspace__blender-toolbar
  > button:focus-visible
  .reconstruction-workspace__blender-tool-tooltip {
  opacity:
    1 !important;

  visibility:
    visible !important;

  transform:
    translateX(0) !important;
}

.reconstruction-workspace__blender-tool-tooltip-title {
  display:
    flex !important;

  align-items:
    center !important;

  justify-content:
    space-between !important;

  gap:
    8px !important;
}

.reconstruction-workspace__blender-tool-tooltip
  strong {
  color:
    #eee !important;

  font-size:
    9.5px !important;

  font-weight:
    700 !important;
}

.reconstruction-workspace__blender-tool-tooltip
  small {
  color:
    #8d8d8d !important;

  font-size:
    8px !important;

  line-height:
    1.4 !important;
}

.reconstruction-workspace
  kbd {
  min-width:
    20px !important;

  min-height:
    18px !important;

  display:
    inline-grid !important;

  place-items:
    center !important;

  padding:
    1px 5px !important;

  border:
    1px solid #555 !important;

  border-bottom-color:
    #252525 !important;

  border-radius:
    2px !important;

  background:
    linear-gradient(
      180deg,
      #444,
      #303030
    ) !important;

  color:
    #ddd !important;

  font-family:
    ui-monospace,
    SFMono-Regular,
    Menlo,
    Consolas,
    monospace !important;

  font-size:
    7.5px !important;

  font-weight:
    700 !important;

  line-height:
    1 !important;

  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.06),
    0 1px 0 #111 !important;
}

/* Persistent giant SELECT AND INSPECT hint is gone. */
.reconstruction-workspace
  .reconstruction-workspace__tool-hint {
  display:
    none !important;
}

/* ========================================================================== */
/* Shortcut sheet — keyboard only (? toggles it).                             */
/* ========================================================================== */

.reconstruction-workspace__shortcut-sheet {
  position:
    absolute !important;

  z-index:
    135 !important;

  top:
    8px !important;

  left:
    56px !important;

  width:
    min(340px, calc(100% - 72px)) !important;

  overflow:
    hidden !important;

  border:
    1px solid #555 !important;

  border-radius:
    2px !important;

  background:
    #292929 !important;

  color:
    #d4d4d4 !important;

  box-shadow:
    0 14px 32px rgba(0,0,0,.42) !important;
}

.reconstruction-workspace__shortcut-sheet
  > header {
  min-height:
    36px !important;

  display:
    flex !important;

  align-items:
    center !important;

  justify-content:
    space-between !important;

  gap:
    8px !important;

  padding:
    5px 6px 5px 9px !important;

  border-bottom:
    1px solid #171717 !important;

  background:
    linear-gradient(
      180deg,
      #363636,
      #2d2d2d
    ) !important;
}

.reconstruction-workspace__shortcut-sheet
  > header
  > div {
  display:
    flex !important;

  flex-direction:
    column !important;

  gap:
    1px !important;
}

.reconstruction-workspace__shortcut-sheet
  > header
  span {
  color:
    #858585 !important;

  font-size:
    7px !important;

  text-transform:
    uppercase !important;

  letter-spacing:
    .08em !important;
}

.reconstruction-workspace__shortcut-sheet
  > header
  strong {
  color:
    #e1e1e1 !important;

  font-size:
    10px !important;
}

.reconstruction-workspace__shortcut-sheet
  > header
  button {
  width:
    24px !important;

  min-width:
    24px !important;

  height:
    24px !important;

  min-height:
    24px !important;

  padding:
    0 !important;
}

.reconstruction-workspace__shortcut-groups {
  display:
    grid !important;

  grid-template-columns:
    repeat(
      3,
      minmax(0, 1fr)
    ) !important;

  gap:
    0 !important;
}

.reconstruction-workspace__shortcut-groups
  > section {
  min-width:
    0 !important;

  padding:
    7px !important;

  border-right:
    1px solid #1b1b1b !important;

  background:
    #292929 !important;
}

.reconstruction-workspace__shortcut-groups
  > section:last-child {
  border-right:
    0 !important;
}

.reconstruction-workspace__shortcut-groups
  > section
  > strong {
  display:
    block !important;

  margin-bottom:
    5px !important;

  color:
    #9d9d9d !important;

  font-size:
    8px !important;

  text-transform:
    uppercase !important;

  letter-spacing:
    .06em !important;
}

.reconstruction-workspace__shortcut-groups
  > section
  > div {
  display:
    grid !important;

  gap:
    4px !important;
}

.reconstruction-workspace__shortcut-groups
  > section
  > div
  > span {
  min-width:
    0 !important;

  display:
    flex !important;

  align-items:
    center !important;

  gap:
    4px !important;

  color:
    #b5b5b5 !important;

  font-size:
    8px !important;
}

@media (max-width: 760px) {
  .reconstruction-workspace__shortcut-groups {
    grid-template-columns:
      minmax(0, 1fr) !important;
  }

  .reconstruction-workspace__shortcut-groups
    > section {
    border-right:
      0 !important;

    border-bottom:
      1px solid #1b1b1b !important;
  }
}

${CSS_END}
`;

css =
  `${css.trimEnd()}\n\n${cssPatch.trim()}\n`;

/* ========================================================================== */
/* Structural verification before writing.                                   */
/* ========================================================================== */

for (
  const token of [
    "workspaceToolbarVisible",
    "shortcutHelpVisible",
    'shortcut: "G"',
    "handleViewportShortcut",
    'case "g":',
    'case "r":',
    'case "s":',
    'case "m":',
    'case "c":',
    "event.code === \"Space\"",
    "reconstruction-workspace__blender-toolbar",
    "reconstruction-workspace__shortcut-sheet",
  ]
) {
  if (!editor.includes(token)) {
    fail(
      `Editor verification failed: ${token}`,
    );
  }
}

if (
  editor.includes(
    "renderWorkspaceToolHint()",
  )
) {
  fail(
    "Persistent workspace tool hint call survived the transformation.",
  );
}

for (
  const token of [
    CSS_START,
    ".reconstruction-workspace__blender-toolbar",
    ".reconstruction-workspace__blender-tool-tooltip",
    ".reconstruction-workspace__shortcut-sheet",
    "width: 40px !important",
  ]
) {
  if (!css.includes(token)) {
    fail(
      `CSS verification failed: ${token}`,
    );
  }
}

/* Parse transformed parent before write. */
try {
  const require =
    createRequire(
      import.meta.url,
    );

  const ts =
    require(
      "typescript",
    );

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

  if (
    diagnostics.length >
    0
  ) {
    const details =
      diagnostics
        .slice(
          0,
          20,
        )
        .map(
          (diagnostic) => {
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
              sourceFile
                .getLineAndCharacterOfPosition(
                  diagnostic.start,
                );

            return (
              `line ${position.line + 1}, ` +
              `column ${position.character + 1}: ` +
              message
            );
          },
        )
        .join(
          "\n",
        );

    fail(
      `TSX parse audit failed:\n${details}`,
    );
  }

  console.log(
    "Blender toolbar + keyboard TSX parse audit: PASS",
  );
} catch (error) {
  if (
    String(
      error,
    ).includes(
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

/* ========================================================================== */
/* Backup + write.                                                            */
/* ========================================================================== */

fs.mkdirSync(
  backupRoot,
  {
    recursive: true,
  },
);

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
      cssPath:
        path.relative(
          root,
          cssPath,
        ),
      originalEditor,
      originalCss,
    },
    null,
    2,
  ),
  "utf8",
);

function restore() {
  fs.writeFileSync(
    editorPath,
    originalEditor,
    "utf8",
  );

  fs.writeFileSync(
    cssPath,
    originalCss,
    "utf8",
  );

  fs.rmSync(
    statePath,
    {
      force: true,
    },
  );
}

fs.writeFileSync(
  editorPath,
  editor,
  "utf8",
);

fs.writeFileSync(
  cssPath,
  css,
  "utf8",
);

/* ========================================================================== */
/* Full build.                                                                */
/* ========================================================================== */

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
      cwd: root,
      encoding: "utf8",
      shell: false,
      env: process.env,
    },
  );

const output =
  [
    "RoadSafe Blender Viewport Toolbar + Keyboard Shortcuts V1",
    "========================================================",
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
    build.stdout ?? "",
    "",
    "STDERR",
    "------",
    build.stderr ?? "",
  ].join(
    "\n",
  );

fs.writeFileSync(
  buildLogPath,
  output,
  "utf8",
);

if (build.stdout) {
  process.stdout.write(
    build.stdout,
  );
}

if (build.stderr) {
  process.stderr.write(
    build.stderr,
  );
}

if (
  build.status === null ||
  build.status !== 0
) {
  console.error("");
  console.error(
    "Build failed. Restoring original files...",
  );

  restore();

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
  "RoadSafe Blender Viewport Toolbar + Keyboard Shortcuts V1 installed successfully.",
);

console.log("");
console.log(
  "Viewport toolbar:",
);

console.log(
  "  icon-only Blender-style rail in BOTH 2D and 3D",
);

console.log(
  "  T toggles toolbar",
);

console.log(
  "  hover an icon for tool name, shortcut and contextual help",
);

console.log("");
console.log(
  "Shortcuts:",
);

console.log(
  "  W Select   G Move   R Rotate   S Scale",
);

console.log(
  "  M Measure  C Camera  Shift+T Timeline",
);

console.log(
  "  Space Play/Pause   N Properties",
);

console.log(
  "  1 2D   3 3D   Home Fit 2D   ? Help",
);

console.log(
  "  Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y history remains active",
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
  "  node revoke-blender-viewport-toolbar-shortcuts-v1.mjs",
);
