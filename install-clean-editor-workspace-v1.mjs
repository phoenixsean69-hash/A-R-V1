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

const bottomDockPath =
  path.join(
    root,
    "src/components/reconstruction/ReconstructionBottomDock.tsx",
  );

const bottomDockCssPath =
  path.join(
    root,
    "src/components/reconstruction/reconstructionBottomDock.css",
  );

const payloadDockPath =
  path.join(
    scriptDir,
    "ReconstructionBottomDock.tsx",
  );

const payloadCssPath =
  path.join(
    scriptDir,
    "reconstructionBottomDock.css",
  );

const backupRoot =
  path.join(
    root,
    ".roadsafe-ui-backup",
  );

const statePath =
  path.join(
    backupRoot,
    "last-clean-editor-workspace-v1.json",
  );

const buildLogPath =
  path.join(
    backupRoot,
    "clean-editor-workspace-v1-build.log",
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
    payloadDockPath,
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

const originalEditor =
  fs.readFileSync(
    editorPath,
    "utf8",
  );

const originalBottomDock =
  fs.existsSync(bottomDockPath)
    ? fs.readFileSync(
        bottomDockPath,
        "utf8",
      )
    : null;

const originalBottomDockCss =
  fs.existsSync(bottomDockCssPath)
    ? fs.readFileSync(
        bottomDockCssPath,
        "utf8",
      )
    : null;

let editor =
  originalEditor;

/* ======================================================================== */
/* Preconditions: this package targets the successful standalone Timeline V5 */
/* ======================================================================== */

for (
  const token of [
    'import ReconstructionTimelineDock from "./ReconstructionTimelineDock";',
    "<ReconstructionTimelineDock",
    'className={`reconstruction-workspace__workspace-panels ${',
    '<div className="reconstruction-workspace__modules">',
    "<ReconstructionNodeEditor",
    "workspaceRightPanelHost",
  ]
) {
  if (!editor.includes(token)) {
    fail(
      `Expected current reconstruction marker missing: ${token}. No files changed.`,
    );
  }
}

/* ======================================================================== */
/* Imports                                                                   */
/* ======================================================================== */

editor =
  editor.replace(
    'import ReconstructionTimelineDock from "./ReconstructionTimelineDock";',
    'import ReconstructionBottomDock from "./ReconstructionBottomDock";',
  );

editor =
  editor.replace(
    'import ReconstructionNodeEditor from "./ReconstructionNodeEditor";\n',
    "",
  );

/* ======================================================================== */
/* State                                                                     */
/* ======================================================================== */

/*
 * Workspace/investigation cards are no longer centre content. Keep them
 * closed by default so normal 2D/3D Properties remains visible on load.
 */
editor =
  editor.replace(
    /const \[workspaceSettingsOpen,\s*setWorkspaceSettingsOpen\]\s*=\s*useState\(true\);/,
    "const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);",
  );

/* Node open/closed state now belongs to the independent bottom dock. */
editor =
  editor.replace(
    /^[\t ]*const \[nodeEditorOpen,\s*setNodeEditorOpen\]\s*=\s*useState\(true\);\r?\n/m,
    "",
  );

/* ======================================================================== */
/* Header buttons                                                            */
/* ======================================================================== */

/* Panels now opens the right-side auxiliary inspector without forcing 2D. */
const panelsButtonOld =
`          <button
            type="button"
            onClick={() => {
              setActiveReconstructionView("2D");
              setWorkspaceSettingsOpen((value) => !value);
            }}
            className="reconstruction-workspace__button"
          >
            Panels
          </button>`;

const panelsButtonNew =
`          <button
            type="button"
            onClick={() =>
              setWorkspaceSettingsOpen(
                (value) => !value,
              )
            }
            className={\`reconstruction-workspace__button \${
              workspaceSettingsOpen ? "is-active" : ""
            }\`}
            aria-pressed={workspaceSettingsOpen}
          >
            Panels
          </button>`;

if (!editor.includes(panelsButtonOld)) {
  fail(
    "Could not locate current Panels button. No files changed.",
  );
}

editor =
  editor.replace(
    panelsButtonOld,
    panelsButtonNew,
  );

/* Nodes activates the Nodes tab in the screen bottom dock. */
const nodesButtonRegex =
  /<button\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => setNodeEditorOpen\(\(value\) => !value\)\}[\s\S]*?>\s*<Layers3 size=\{14\} \/>\s*Nodes\s*<\/button>/m;

const nodesMatch =
  editor.match(
    nodesButtonRegex,
  );

if (!nodesMatch) {
  fail(
    "Could not locate current Nodes header button. No files changed.",
  );
}

editor =
  editor.replace(
    nodesMatch[0],
`<button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new Event(
                  "roadsafe:nodes-open",
                ),
              )
            }
            className="reconstruction-workspace__button"
            aria-label="Open reconstruction nodes"
          >
            <Layers3 size={14} />
            Nodes
          </button>`,
  );

/* Objects & Evidence opens the migrated right inspector. */
const objectsButtonOldStart =
`<button
            type="button"
            onClick={() => {
              setActiveReconstructionView("2D");
              setWorkspaceSettingsOpen(true);`;

if (
  editor.includes(
    objectsButtonOldStart,
  )
) {
  editor =
    editor.replace(
      objectsButtonOldStart,
`<button
            type="button"
            onClick={() => {
              setWorkspaceSettingsOpen(true);`,
    );
}

/* ======================================================================== */
/* 3D Properties: portal it to the real AppShell right host                  */
/* ======================================================================== */

const threeDOpen =
  '            {workspacePropertiesOpen ? (';

const threeDOpenIndex =
  editor.indexOf(
    threeDOpen,
  );

if (threeDOpenIndex < 0) {
  fail(
    "Could not locate 3D Properties conditional. No files changed.",
  );
}

editor =
  editor.slice(
    0,
    threeDOpenIndex,
  ) +
  editor
    .slice(
      threeDOpenIndex,
    )
    .replace(
      threeDOpen,
      '            {workspaceRightPanelHost && workspacePropertiesOpen ? createPortal(',
      1,
    );

const threeDAsideCloseNeedle =
`              </aside>
            ) : (
              <button
                type="button"
                className="reconstruction-workspace__inspector-tab"`;

const threeDAsideCloseReplacement =
`              </aside>,
                workspaceRightPanelHost,
              ) : (
              <button
                type="button"
                className="reconstruction-workspace__inspector-tab"`;

const afterThreeDOpen =
  editor.indexOf(
    'workspaceRightPanelHost && workspacePropertiesOpen ? createPortal(',
  );

const asideCloseIndex =
  editor.indexOf(
    threeDAsideCloseNeedle,
    afterThreeDOpen,
  );

if (asideCloseIndex < 0) {
  fail(
    "Could not isolate 3D Properties aside close. No files changed.",
  );
}

editor =
  editor.slice(
    0,
    asideCloseIndex,
  ) +
  threeDAsideCloseReplacement +
  editor.slice(
    asideCloseIndex +
      threeDAsideCloseNeedle.length,
  );

/* ======================================================================== */
/* 2D scene header: mark it legacy so CSS can remove it from centre          */
/* ======================================================================== */

const legacyToolbarClass =
  'className="reconstruction-workspace__legacy-scene-toolbar flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#494949] bg-[#292929] px-4 py-3"';

if (!editor.includes(legacyToolbarClass)) {
  const oldToolbarClass =
    'className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#494949] bg-[#292929] px-4 py-3"';

  if (!editor.includes(oldToolbarClass)) {
    fail(
      "Could not locate 2D Reconstruction Scene toolbar. No files changed.",
    );
  }

  editor =
    editor.replace(
      oldToolbarClass,
      legacyToolbarClass,
    );
}

/* ======================================================================== */
/* Remove inline Node editor from normal centre-page flow                    */
/* ======================================================================== */

const inlineNodeRegex =
  /\n\s*<ReconstructionNodeEditor[\s\S]*?\n\s*\/>\s*\n/m;

const inlineNodeMatch =
  editor.match(
    inlineNodeRegex,
  );

if (!inlineNodeMatch) {
  fail(
    "Could not isolate inline ReconstructionNodeEditor. No files changed.",
  );
}

editor =
  editor.replace(
    inlineNodeMatch[0],
    "\n",
  );

/* ======================================================================== */
/* Portal existing Workspace Panels + investigation modules to right host    */
/* ======================================================================== */

const workspacePanelsStart =
  editor.indexOf(
    '<section\n          className={`reconstruction-workspace__workspace-panels ${',
  );

if (workspacePanelsStart < 0) {
  fail(
    "Could not locate Workspace Panels section. No files changed.",
  );
}

const investigationDetailStart =
  editor.indexOf(
    '        {activeInvestigationDetail && (',
    workspacePanelsStart,
  );

if (
  investigationDetailStart < 0
) {
  fail(
    "Could not locate end of centre investigation modules. No files changed.",
  );
}

const migratedContent =
  editor.slice(
    workspacePanelsStart,
    investigationDetailStart,
  );

if (
  !migratedContent.includes(
    '<div className="reconstruction-workspace__modules">',
  ) ||
  !migratedContent.includes(
    "Primary Impact Setup",
  ) ||
  !migratedContent.includes(
    "SceneSettingsPanel",
  ) ||
  !migratedContent.includes(
    "SceneObjectPalette",
  )
) {
  fail(
    "The intended migrated centre block did not contain all expected sections. No files changed.",
  );
}

const auxiliaryWrapper =
`{workspaceRightPanelHost &&
          workspaceSettingsOpen &&
          createPortal(
            <aside
              className="reconstruction-workspace__aux-inspector"
              aria-label="Workspace and investigation properties"
            >
              <header className="reconstruction-workspace__aux-inspector-header">
                <div>
                  <span>Properties</span>
                  <strong>Workspace & Investigation</strong>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setWorkspaceSettingsOpen(false)
                  }
                  aria-label="Close workspace properties"
                  title="Close workspace properties"
                >
                  <X size={14} />
                </button>
              </header>

              <div className="reconstruction-workspace__aux-inspector-tools">
                <div
                  className="reconstruction-workspace__aux-basemap"
                  aria-label="2D basemap"
                >
                  {(
                    [
                      "Diagram",
                      "Street",
                      "Satellite",
                    ] as ReconstructionBasemapMode[]
                  ).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={
                        basemapMode === mode
                          ? "is-active"
                          : ""
                      }
                      aria-pressed={
                        basemapMode === mode
                      }
                      onClick={() =>
                        setBasemapMode(mode)
                      }
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                <div className="reconstruction-workspace__aux-actions">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={!historyAvailability.canUndo}
                  >
                    Undo
                  </button>

                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={!historyAvailability.canRedo}
                  >
                    Redo
                  </button>

                  <button
                    type="button"
                    disabled={!selectedParticipantId}
                    onClick={() => {
                      setActiveReconstructionView("2D");

                      setRouteDrawingParticipantId(
                        (current) =>
                          current
                            ? null
                            : selectedParticipantId,
                      );
                    }}
                  >
                    {routeDrawingParticipantId
                      ? "Cancel Route"
                      : "Draw Route"}
                  </button>
                </div>

                <div className="reconstruction-workspace__aux-legend">
                  <span>Start</span>
                  <span>Brake</span>
                  <span>Turn / Swerve</span>
                  <span>Impact</span>
                </div>
              </div>

              <div className="reconstruction-workspace__aux-inspector-content">
${migratedContent}
              </div>
            </aside>,
            workspaceRightPanelHost,
          )}

`;

editor =
  editor.slice(
    0,
    workspacePanelsStart,
  ) +
  auxiliaryWrapper +
  editor.slice(
    investigationDetailStart,
  );

/* ======================================================================== */
/* Replace standalone Timeline component with new Timeline / Nodes dock      */
/* ======================================================================== */

editor =
  editor.replace(
    "<ReconstructionTimelineDock",
    "<ReconstructionBottomDock",
  );

const dockPropsAnchor =
`        playbackSpeed={playbackSpeed}
        onReset={handleReset}`;

if (!editor.includes(dockPropsAnchor)) {
  fail(
    "Could not locate bottom Timeline props. No files changed.",
  );
}

editor =
  editor.replace(
    dockPropsAnchor,
`        playbackSpeed={playbackSpeed}
        activeView={activeReconstructionView}
        selectedParticipantId={selectedParticipantId}
        selectedSceneObjectId={selectedSceneObjectId}
        onSelectParticipant={(participantId) =>
          handleSelectParticipant(participantId)
        }
        onReset={handleReset}`,
  );

/* ======================================================================== */
/* Structural verification                                                    */
/* ======================================================================== */

const requiredTokens = [
  'import ReconstructionBottomDock from "./ReconstructionBottomDock";',
  "<ReconstructionBottomDock",
  '"roadsafe:nodes-open"',
  "reconstruction-workspace__legacy-scene-toolbar",
  "reconstruction-workspace__aux-inspector",
  "Workspace & Investigation",
  "workspaceRightPanelHost && workspacePropertiesOpen ? createPortal(",
];

for (const token of requiredTokens) {
  if (!editor.includes(token)) {
    fail(
      `Clean editor structural guard failed: ${token}`,
    );
  }
}

if (
  editor.includes(
    'import ReconstructionNodeEditor from "./ReconstructionNodeEditor";',
  )
) {
  fail(
    "Inline Node editor import still exists after migration.",
  );
}

if (
  /<ReconstructionNodeEditor\b/.test(
    editor,
  )
) {
  fail(
    "Inline ReconstructionNodeEditor still exists in AccidentReconstructionEditor.",
  );
}

if (
  editor.includes(
    "<ReconstructionTimelineDock",
  )
) {
  fail(
    "Old standalone Timeline component is still mounted.",
  );
}

const workspacePanelsCount =
  (
    editor.match(
      /reconstruction-workspace__workspace-panels/g,
    ) ?? []
  ).length;

if (workspacePanelsCount < 1) {
  fail(
    "Workspace Panels disappeared during right-panel migration.",
  );
}

/* ======================================================================== */
/* Parse complete transformed TSX + new component before writing             */
/* ======================================================================== */

const bottomDockSource =
  fs.readFileSync(
    payloadDockPath,
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
          .slice(0, 16)
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
    "ReconstructionBottomDock.tsx",
    bottomDockSource,
  );

  console.log(
    "Clean editor TSX parse audit: PASS",
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

/* ======================================================================== */
/* Backup + write                                                              */
/* ======================================================================== */

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

      bottomDockPath:
        path.relative(
          root,
          bottomDockPath,
        ),

      bottomDockCssPath:
        path.relative(
          root,
          bottomDockCssPath,
        ),

      originalEditor,
      originalBottomDock,
      originalBottomDockCss,
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

  if (
    originalBottomDock === null
  ) {
    fs.rmSync(
      bottomDockPath,
      { force: true },
    );
  } else {
    fs.writeFileSync(
      bottomDockPath,
      originalBottomDock,
      "utf8",
    );
  }

  if (
    originalBottomDockCss === null
  ) {
    fs.rmSync(
      bottomDockCssPath,
      { force: true },
    );
  } else {
    fs.writeFileSync(
      bottomDockCssPath,
      originalBottomDockCss,
      "utf8",
    );
  }

  console.log(
    "RESTORED pre-clean-editor workspace files.",
  );
}

fs.writeFileSync(
  editorPath,
  editor,
  "utf8",
);

fs.writeFileSync(
  bottomDockPath,
  bottomDockSource,
  "utf8",
);

fs.writeFileSync(
  bottomDockCssPath,
  fs.readFileSync(
    payloadCssPath,
    "utf8",
  ),
  "utf8",
);

console.log("");
console.log(
  "CLEAN EDITOR WORKSPACE WRITTEN.",
);
console.log("");
console.log(
  "Running full project build...",
);

function runBuild() {
  const command =
    process.platform === "win32"
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
          executable: "npm",
          args: [
            "run",
            "build",
          ],
        };

  const result =
    spawnSync(
      command.executable,
      command.args,
      {
        cwd: root,
        encoding: "utf8",
        shell: false,
        windowsHide: false,
        env: process.env,
      },
    );

  const output =
    [
      "RoadSafe Clean Editor Workspace V1 build",
      "========================================",
      `platform: ${process.platform}`,
      `executable: ${command.executable}`,
      `args: ${JSON.stringify(command.args)}`,
      `status: ${String(result.status)}`,
      `signal: ${String(result.signal)}`,
      `error: ${
        result.error
          ? `${result.error.name}: ${result.error.message}`
          : "none"
      }`,
      "",
      "STDOUT",
      "------",
      result.stdout ?? "",
      "",
      "STDERR",
      "------",
      result.stderr ?? "",
      "",
    ].join("\n");

  fs.writeFileSync(
    buildLogPath,
    output,
    "utf8",
  );

  if (result.stdout) {
    process.stdout.write(
      result.stdout,
    );
  }

  if (result.stderr) {
    process.stderr.write(
      result.stderr,
    );
  }

  if (result.error) {
    console.error(
      `BUILD LAUNCH ERROR: ${result.error.name}: ${result.error.message}`,
    );
  }

  return result;
}

const build =
  runBuild();

if (
  build.status === null ||
  build.status !== 0
) {
  console.error("");
  console.error(
    build.status === null
      ? "Build command could not be launched."
      : `Build failed with exit code ${build.status}.`,
  );

  console.error(
    `Full build output kept at: ${path.relative(
      root,
      buildLogPath,
    )}`,
  );

  console.error(
    "Restoring pre-clean-editor workspace files...",
  );

  restore();

  fs.rmSync(
    statePath,
    { force: true },
  );

  console.error("");
  console.error(
    "The build log was intentionally preserved for diagnosis.",
  );

  process.exit(
    build.status ?? 1,
  );
}

console.log("");
console.log(
  "RoadSafe Clean Editor Workspace V1 installed successfully.",
);
console.log("");
console.log(
  "Centre workspace:",
);
console.log(
  "- 2D map only;");
console.log(
  "- 3D scene only;");
console.log(
  "- no inline Nodes;");
console.log(
  "- no Workspace Panels / investigation cards.");
console.log("");
console.log(
  "Bottom editor:");
console.log(
  "- Timeline / Nodes tabs;");
console.log(
  "- Nodes can maximize into the complete centre editor;");
console.log(
  "- right Properties stays visible.");
console.log("");
console.log(
  "Right Properties:");
console.log(
  "- 2D Properties stays in AppShell right host;");
console.log(
  "- 3D Properties is now portaled to the same right host;");
console.log(
  "- Panels / Objects / investigation modules are migrated there.");
console.log("");
console.log(
  "Start:");
console.log(
  "  npm run dev");
console.log("");
console.log(
  "Rollback:");
console.log(
  "  node revoke-clean-editor-workspace-v1.mjs");
