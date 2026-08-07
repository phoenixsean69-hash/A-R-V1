import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const scriptDir =
  path.dirname(
    fileURLToPath(
      import.meta.url,
    ),
  );

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

const colourGuardPath =
  path.join(
    root,
    "src/styles/blenderColorGuard.css",
  );

const panelMarkupPath =
  path.join(
    scriptDir,
    "panel-markup.txt",
  );

const panelStylePath =
  path.join(
    scriptDir,
    "panel-style.css",
  );

const backupRoot =
  path.join(
    root,
    ".roadsafe-ui-backup",
  );

const statePath =
  path.join(
    backupRoot,
    "last-reconstruction-blender-properties-v4.json",
  );

const V3_START =
  "/* [RoadSafe:BlenderRightPropertiesV3:start] */";

const V3_END =
  "/* [RoadSafe:BlenderRightPropertiesV3:end] */";

const V4_START =
  "/* [RoadSafe:ReconstructionBlenderPropertiesV4:start] */";

const V4_END =
  "/* [RoadSafe:ReconstructionBlenderPropertiesV4:end] */";

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
    panelMarkupPath,
    panelStylePath,
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

const originalColourGuard =
  fs.readFileSync(
    colourGuardPath,
    "utf8",
  );

function restore() {
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

  console.log(
    "Restored pre-V4 reconstruction properties files.",
  );
}

let editor =
  originalEditor;

let colourGuard =
  originalColourGuard;

/*
 * Remove the previous CSS-only V3 attempt if it is still installed.
 */
{
  const start =
    colourGuard.indexOf(
      V3_START,
    );

  if (start >= 0) {
    const end =
      colourGuard.indexOf(
        V3_END,
        start,
      );

    if (end < 0) {
      fail(
        "Found an incomplete V3 CSS marker block. Run the V3 rollback first.",
      );
    }

    colourGuard =
      colourGuard.slice(
        0,
        start,
      ) +
      colourGuard.slice(
        end + V3_END.length,
      );

    console.log(
      "REMOVED previous Blender right-panel V3 CSS.",
    );
  }
}

/*
 * Remove a previous V4 CSS block so the installer is idempotent.
 */
{
  const start =
    colourGuard.indexOf(
      V4_START,
    );

  if (start >= 0) {
    const end =
      colourGuard.indexOf(
        V4_END,
        start,
      );

    if (end < 0) {
      fail(
        "Found an incomplete previous V4 CSS block.",
      );
    }

    colourGuard =
      colourGuard.slice(
        0,
        start,
      ) +
      colourGuard.slice(
        end + V4_END.length,
      );
  }
}

/*
 * Add the real properties-tab type.
 */
const cameraType =
  'type WorkspaceCameraMode = "Orbit" | "Overhead" | "Roadside" | "Driver";';

const propertiesType =
`type WorkspacePropertiesTab =
  | "participant"
  | "camera"
  | "layers"
  | "physics"
  | "scene";`;

if (
  !editor.includes(
    "type WorkspacePropertiesTab =",
  )
) {
  if (
    !editor.includes(
      cameraType,
    )
  ) {
    fail(
      "Could not locate WorkspaceCameraMode type.",
    );
  }

  editor =
    editor.replace(
      cameraType,
      `${cameraType}\n\n${propertiesType}`,
    );
}

/*
 * Add properties-tab state.
 */
const cameraState =
`  const [workspaceCameraMode, setWorkspaceCameraMode] =
    useState<WorkspaceCameraMode>("Orbit");`;

const propertiesState =
`  const [workspacePropertiesTab, setWorkspacePropertiesTab] =
    useState<WorkspacePropertiesTab>("participant");`;

if (
  !editor.includes(
    "const [workspacePropertiesTab, setWorkspacePropertiesTab]",
  )
) {
  if (
    !editor.includes(
      cameraState,
    )
  ) {
    fail(
      "Could not locate workspaceCameraMode state.",
    );
  }

  editor =
    editor.replace(
      cameraState,
      `${cameraState}\n${propertiesState}`,
    );
}

/*
 * Replace the ACTUAL right-side 3D reconstruction inspector.
 */
const oldAsideStart =
  '<aside className="reconstruction-workspace__properties reconstruction-workspace__context-panel">';

const newAsideStart =
  '<aside className="reconstruction-workspace__properties reconstruction-workspace__context-panel reconstruction-workspace__blender-properties">';

const panelMarkup =
  fs.readFileSync(
    panelMarkupPath,
    "utf8",
  ).trim();

if (
  !editor.includes(
    newAsideStart,
  )
) {
  const start =
    editor.indexOf(
      oldAsideStart,
    );

  if (start < 0) {
    fail(
      "Could not locate the real 3D reconstruction properties <aside>.",
    );
  }

  const endToken =
    "</aside>";

  const end =
    editor.indexOf(
      endToken,
      start,
    );

  if (end < 0) {
    fail(
      "Could not isolate the real 3D reconstruction properties panel.",
    );
  }

  editor =
    editor.slice(
      0,
      start,
    ) +
    panelMarkup +
    editor.slice(
      end + endToken.length,
    );
}

/*
 * Append the dedicated late-loaded V4 panel style into blenderColorGuard.css.
 */
const panelStyle =
  fs.readFileSync(
    panelStylePath,
    "utf8",
  ).trim();

if (
  !panelStyle.startsWith(
    V4_START,
  ) ||
  !panelStyle.endsWith(
    V4_END,
  )
) {
  fail(
    "V4 CSS payload markers are invalid.",
  );
}

colourGuard =
  `${colourGuard.trimEnd()}\n\n${panelStyle}\n`;

/*
 * Structural guards before writing.
 */
const requiredEditorTokens = [
  "type WorkspacePropertiesTab =",
  "workspacePropertiesTab",
  "setWorkspacePropertiesTab",
  "reconstruction-workspace__blender-properties",
  "reconstruction-workspace__blender-properties-tabs",
  "reconstruction-workspace__blender-properties-section",
  'workspacePropertiesTab === "participant"',
  'workspacePropertiesTab === "camera"',
  'workspacePropertiesTab === "layers"',
  'workspacePropertiesTab === "physics"',
  'workspacePropertiesTab === "scene"',
  "getParticipantAssetsForType",
  "ReconstructionParticipantAssetId",
];

for (const token of requiredEditorTokens) {
  if (!editor.includes(token)) {
    fail(
      `V4 structural guard failed: ${token}`,
    );
  }
}

/*
 * Parse the ENTIRE transformed TSX with the repo's own TypeScript parser.
 * This catches malformed JSX before anything is written.
 */
try {
  const require =
    createRequire(
      import.meta.url,
    );

  const ts =
    require("typescript");

  const sourceFile =
    ts.createSourceFile(
      "AccidentReconstructionEditor.tsx",
      editor,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

  const parseDiagnostics =
    sourceFile.parseDiagnostics ?? [];

  if (parseDiagnostics.length > 0) {
    const details =
      parseDiagnostics
        .slice(0, 8)
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
      `Transformed TSX parse audit failed:\n${details}`,
    );
  }

  console.log(
    "TSX parse audit: PASS",
  );
} catch (error) {
  if (
    String(error).includes(
      "Cannot find module 'typescript'",
    )
  ) {
    console.warn(
      "TypeScript parser was not available to the installer; structural guards still passed.",
    );
  } else {
    throw error;
  }
}

/*
 * CSS brace guard.
 */
{
  const opens =
    (
      panelStyle.match(
        /\{/g,
      ) ?? []
    ).length;

  const closes =
    (
      panelStyle.match(
        /\}/g,
      ) ?? []
    ).length;

  if (opens !== closes) {
    fail(
      `CSS brace audit failed: ${opens} opening / ${closes} closing.`,
    );
  }

  console.log(
    "CSS audit: PASS",
  );
}

fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      installedAt:
        new Date().toISOString(),
      editor:
        path.relative(
          root,
          editorPath,
        ),
      colourGuard:
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
  "RoadSafe reconstruction Blender Properties V4 installed.",
);
console.log("");
console.log(
  "Modified the real panel in:",
);
console.log(
  "  src/components/reconstruction/AccidentReconstructionEditor.tsx",
);
console.log("");
console.log(
  "Style appended to the already-loaded:",
);
console.log(
  "  src/styles/blenderColorGuard.css",
);
console.log("");
console.log(
  "Start:",
);
console.log(
  "  npm run dev",
);
console.log("");
console.log(
  "Optional verification:",
);
console.log(
  "  npm run build",
);
console.log("");
console.log(
  "Rollback:",
);
console.log(
  "  node revoke-reconstruction-blender-properties-v4.mjs",
);
