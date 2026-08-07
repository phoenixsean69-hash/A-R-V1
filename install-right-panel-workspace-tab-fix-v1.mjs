import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();

const packagePath = path.join(root, "package.json");
const editorPath = path.join(
  root,
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
);

const backupRoot = path.join(
  root,
  ".roadsafe-ui-backup",
);

const statePath = path.join(
  backupRoot,
  "last-right-panel-workspace-tab-fix-v1.json",
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

const pkg = JSON.parse(
  fs.readFileSync(packagePath, "utf8"),
);

if (pkg.name !== "roadsafe-ar") {
  fail(
    `Expected package "roadsafe-ar", found "${pkg.name ?? "unknown"}".`,
  );
}

if (!fs.existsSync(editorPath)) {
  fail(
    "Could not find AccidentReconstructionEditor.tsx.",
  );
}

const original = fs.readFileSync(
  editorPath,
  "utf8",
);

let source = original;

for (const token of [
  'className="reconstruction-workspace__aux-inspector"',
  "Workspace & Investigation",
  "workspaceSettingsOpen",
  'aria-label="2D reconstruction property categories"',
  'aria-label="Reconstruction properties"',
]) {
  if (!source.includes(token)) {
    fail(
      `Expected Clean Editor Workspace marker missing: ${token}. No file changed.`,
    );
  }
}

const tabMarkup = `
                  <button
                    type="button"
                    data-workspace-inspector-tab="true"
                    title="Workspace & Investigation"
                    aria-label="Workspace & Investigation"
                    aria-pressed={workspaceSettingsOpen}
                    className={
                      workspaceSettingsOpen
                        ? "is-active"
                        : ""
                    }
                    onClick={() =>
                      setWorkspaceSettingsOpen(true)
                    }
                  >
                    <Layers3 size={15} />
                  </button>
`;

function insertBeforeNavClose(
  content,
  ariaLabel,
) {
  const navStartToken =
    `aria-label="${ariaLabel}"`;

  const navStart =
    content.indexOf(navStartToken);

  if (navStart < 0) {
    fail(
      `Could not locate ${ariaLabel} navigation.`,
    );
  }

  const navClose =
    content.indexOf(
      "</nav>",
      navStart,
    );

  if (navClose < 0) {
    fail(
      `Could not locate end of ${ariaLabel} navigation.`,
    );
  }

  const navBlock =
    content.slice(
      navStart,
      navClose,
    );

  if (
    navBlock.includes(
      'data-workspace-inspector-tab="true"',
    )
  ) {
    return content;
  }

  return (
    content.slice(0, navClose) +
    tabMarkup +
    content.slice(navClose)
  );
}

source = insertBeforeNavClose(
  source,
  "2D reconstruction property categories",
);

source = insertBeforeNavClose(
  source,
  "Reconstruction properties",
);

/*
 * When the user switches to any normal 2D property tab, close the
 * Workspace/Investigation overlay so navigation behaves like real tabs.
 */
const old2DClick =
`                      onClick={() => setWorkspace2DPropertiesTab(tab)}`;

const new2DClick =
`                      onClick={() => {
                        setWorkspaceSettingsOpen(false);
                        setWorkspace2DPropertiesTab(tab);
                      }}`;

if (source.includes(old2DClick)) {
  source = source.replace(
    old2DClick,
    new2DClick,
  );
}

/*
 * Same behavior for 3D normal property categories.
 */
const old3DClick =
`                      onClick={() => setWorkspacePropertiesTab(tab)}`;

const new3DClick =
`                      onClick={() => {
                        setWorkspaceSettingsOpen(false);
                        setWorkspacePropertiesTab(tab);
                      }}`;

if (source.includes(old3DClick)) {
  source = source.replace(
    old3DClick,
    new3DClick,
  );
}

/*
 * Clicking the X in the auxiliary inspector already closes it.
 * Make the auxiliary panel explicitly identify that it contains the sections
 * moved out of the centre workspace.
 */
source = source.replace(
  "<strong>Workspace & Investigation</strong>",
  "<strong>Workspace, Evidence & Investigation</strong>",
);

const tabCount =
  (
    source.match(
      /data-workspace-inspector-tab="true"/g,
    ) ?? []
  ).length;

if (tabCount !== 2) {
  fail(
    `Expected Workspace tab in both 2D and 3D Properties rails, found ${tabCount}. No file changed.`,
  );
}

for (const token of [
  "setWorkspaceSettingsOpen(true)",
  "Workspace, Evidence & Investigation",
  "<Layers3 size={15} />",
]) {
  if (!source.includes(token)) {
    fail(
      `Right-panel tab verification failed: ${token}`,
    );
  }
}

/*
 * Parse the COMPLETE transformed file before writing.
 */
try {
  const require = createRequire(import.meta.url);
  const ts = require("typescript");

  const sf = ts.createSourceFile(
    "AccidentReconstructionEditor.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const diagnostics = sf.parseDiagnostics ?? [];

  if (diagnostics.length > 0) {
    const details = diagnostics
      .slice(0, 12)
      .map((diagnostic) => {
        const message =
          ts.flattenDiagnosticMessageText(
            diagnostic.messageText,
            "\n",
          );

        if (typeof diagnostic.start !== "number") {
          return message;
        }

        const location =
          sf.getLineAndCharacterOfPosition(
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
      `TSX parse audit failed:\n${details}`,
    );
  }

  console.log(
    "Right-panel Workspace tab TSX audit: PASS",
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

fs.mkdirSync(
  backupRoot,
  { recursive: true },
);

fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      installedAt: new Date().toISOString(),
      editorPath:
        path.relative(
          root,
          editorPath,
        ),
      original,
    },
    null,
    2,
  ),
  "utf8",
);

fs.writeFileSync(
  editorPath,
  source,
  "utf8",
);

console.log("");
console.log(
  "RoadSafe right-panel Workspace tab fix installed.",
);
console.log("");
console.log(
  "Both 2D and 3D Properties rails now include:");
console.log(
  "  Workspace & Investigation");
console.log("");
console.log(
  "That tab exposes the sections moved out of the centre:");
console.log(
  "  Case Setup");
console.log(
  "  Scene Environment");
console.log(
  "  Objects / Hazards / Evidence");
console.log(
  "  Primary Impact");
console.log(
  "  Physics");
console.log(
  "  Audit");
console.log(
  "  Hypotheses");
console.log(
  "  Evidence / Measurements");
console.log(
  "  Photos / Officer Notes");
console.log("");
console.log(
  "Start / refresh:");
console.log(
  "  npm run dev");
console.log("");
console.log(
  "Rollback:");
console.log(
  "  node revoke-right-panel-workspace-tab-fix-v1.mjs");
