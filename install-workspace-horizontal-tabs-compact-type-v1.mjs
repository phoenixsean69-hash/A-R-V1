import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();

const packagePath = path.join(root, "package.json");
const editorPath = path.join(
  root,
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
);
const cssPath = path.join(
  root,
  "src/components/reconstruction/reconstructionBottomDock.css",
);

const backupRoot = path.join(
  root,
  ".roadsafe-ui-backup",
);
const statePath = path.join(
  backupRoot,
  "last-workspace-horizontal-tabs-compact-type-v1.json",
);

const CSS_START =
  "/* [RoadSafe:WorkspaceHorizontalTabsCompactTypeV1:start] */";
const CSS_END =
  "/* [RoadSafe:WorkspaceHorizontalTabsCompactTypeV1:end] */";

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

for (const required of [
  editorPath,
  cssPath,
]) {
  if (!fs.existsSync(required)) {
    fail(`Required file missing: ${required}`);
  }
}

const originalEditor =
  fs.readFileSync(editorPath, "utf8");

const originalCss =
  fs.readFileSync(cssPath, "utf8");

let editor = originalEditor;
let css = originalCss;

for (const marker of [
  'className="reconstruction-workspace__aux-inspector"',
  "Workspace, Evidence & Investigation",
  'className="reconstruction-workspace__aux-inspector-content"',
]) {
  if (!editor.includes(marker)) {
    fail(
      `Expected Workspace/Investigation panel marker missing: ${marker}`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* State for the horizontal Workspace/Investigation quick tabs.        */
/* ------------------------------------------------------------------ */

const stateAnchor =
  "  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);";

const stateLine =
`  const [workspaceInvestigationTab, setWorkspaceInvestigationTab] =
    useState("case");`;

if (!editor.includes("workspaceInvestigationTab")) {
  if (!editor.includes(stateAnchor)) {
    fail(
      "Could not locate workspaceSettingsOpen state.",
    );
  }

  editor = editor.replace(
    stateAnchor,
    `${stateAnchor}\n${stateLine}`,
  );
}

/* ------------------------------------------------------------------ */
/* Helper: jump to an existing migrated section by visible heading.    */
/* ------------------------------------------------------------------ */

const helperAnchor =
  "  const handleDurationChange = (durationSeconds: number) => {";

const helper =
`  const handleWorkspaceInvestigationTab = (
    tab: string,
    heading: string,
  ) => {
    setWorkspaceInvestigationTab(tab);

    requestAnimationFrame(() => {
      const container =
        document.querySelector<HTMLElement>(
          ".reconstruction-workspace__aux-inspector-content",
        );

      if (!container) return;

      const candidates =
        Array.from(
          container.querySelectorAll<HTMLElement>(
            "h1, h2, h3, h4, strong, .premium-investigation-card__title, .reconstruction-workspace__workspace-card-title",
          ),
        );

      const normalizedHeading =
        heading
          .trim()
          .toLowerCase();

      const headingElement =
        candidates.find((element) =>
          element.textContent
            ?.trim()
            .toLowerCase()
            .includes(
              normalizedHeading,
            ),
        );

      const target =
        headingElement?.closest<HTMLElement>(
          ".premium-investigation-card, .reconstruction-workspace__workspace-card, section, article",
        ) ??
        headingElement;

      target?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

`;

if (!editor.includes("handleWorkspaceInvestigationTab")) {
  if (!editor.includes(helperAnchor)) {
    fail(
      "Could not locate helper insertion anchor.",
    );
  }

  editor = editor.replace(
    helperAnchor,
    `${helper}${helperAnchor}`,
  );
}

/* ------------------------------------------------------------------ */
/* Insert sticky horizontal secondary tabs after auxiliary header.     */
/* ------------------------------------------------------------------ */

const headerClose =
`              </header>

              <div className="reconstruction-workspace__aux-inspector-tools">`;

const tabsMarkup =
`              </header>

              <nav
                className="reconstruction-workspace__aux-horizontal-tabs"
                aria-label="Workspace and investigation sections"
              >
                {(
                  [
                    ["case", "Case", "Case Setup"],
                    ["scene", "Scene", "Scene Environment"],
                    ["objects", "Objects", "Objects"],
                    ["impact", "Impact", "Primary Impact"],
                    ["physics", "Physics", "Deterministic Simulation"],
                    ["audit", "Audit", "Non-Destructive Audit"],
                    ["hypotheses", "Hypotheses", "Alternative Hypotheses"],
                    ["evidence", "Evidence", "Evidence"],
                    ["notes", "Notes", "Photos"],
                  ] as const
                ).map(([tab, label, heading]) => (
                  <button
                    key={tab}
                    type="button"
                    className={
                      workspaceInvestigationTab === tab
                        ? "is-active"
                        : ""
                    }
                    aria-pressed={
                      workspaceInvestigationTab === tab
                    }
                    onClick={() =>
                      handleWorkspaceInvestigationTab(
                        tab,
                        heading,
                      )
                    }
                  >
                    {label}
                  </button>
                ))}
              </nav>

              <div className="reconstruction-workspace__aux-inspector-tools">`;

if (!editor.includes("reconstruction-workspace__aux-horizontal-tabs")) {
  if (!editor.includes(headerClose)) {
    fail(
      "Could not locate auxiliary inspector header close.",
    );
  }

  editor = editor.replace(
    headerClose,
    tabsMarkup,
  );
}

/* ------------------------------------------------------------------ */
/* CSS: compact typography + sticky horizontal tabs.                   */
/* ------------------------------------------------------------------ */

const previousStart = css.indexOf(CSS_START);

if (previousStart >= 0) {
  const previousEnd =
    css.indexOf(
      CSS_END,
      previousStart,
    );

  if (previousEnd < 0) {
    fail(
      "Found incomplete previous compact-type CSS block.",
    );
  }

  css =
    css.slice(0, previousStart) +
    css.slice(
      previousEnd + CSS_END.length,
    );
}

const cssPatch = `
${CSS_START}

/* Horizontal sub-tabs exist ONLY inside Workspace & Investigation. */
.reconstruction-workspace__aux-horizontal-tabs {
  position: sticky !important;
  top: 0 !important;
  z-index: 12 !important;

  flex: 0 0 auto !important;

  display: flex !important;
  align-items: center !important;

  gap: 2px !important;

  min-width: 0 !important;

  padding: 4px 5px !important;

  overflow-x: auto !important;
  overflow-y: hidden !important;

  border-bottom: 1px solid #171717 !important;

  background: #252525 !important;

  scrollbar-width: none !important;
}

.reconstruction-workspace__aux-horizontal-tabs::-webkit-scrollbar {
  display: none !important;
}

.reconstruction-workspace__aux-horizontal-tabs > button {
  flex: 0 0 auto !important;

  min-height: 24px !important;
  height: 24px !important;

  padding: 2px 7px !important;

  border: 1px solid transparent !important;
  border-radius: 2px !important;

  background: transparent !important;
  color: #9e9e9e !important;

  font-size: 9px !important;
  font-weight: 600 !important;
  line-height: 1 !important;

  box-shadow: none !important;
}

.reconstruction-workspace__aux-horizontal-tabs > button:hover {
  background: #353535 !important;
  color: #e1e1e1 !important;
}

.reconstruction-workspace__aux-horizontal-tabs > button.is-active,
.reconstruction-workspace__aux-horizontal-tabs > button[aria-pressed="true"] {
  border-color: #4b4b4b !important;
  border-bottom-color: #e8872d !important;

  background: #383838 !important;
  color: #f1f1f1 !important;
}

/* ------------------------------------------------------------------ */
/* Compact Workspace/Investigation typography only.                    */
/* ------------------------------------------------------------------ */

/* Large card titles such as CASE SETUP. */
.reconstruction-workspace__aux-inspector
  .premium-investigation-card__header h1,
.reconstruction-workspace__aux-inspector
  .premium-investigation-card__header h2,
.reconstruction-workspace__aux-inspector
  .premium-investigation-card__header h3,
.reconstruction-workspace__aux-inspector
  .premium-investigation-card__header strong,
.reconstruction-workspace__aux-inspector
  .premium-investigation-card__title,
.reconstruction-workspace__aux-inspector
  .reconstruction-workspace__workspace-card h1,
.reconstruction-workspace__aux-inspector
  .reconstruction-workspace__workspace-card h2,
.reconstruction-workspace__aux-inspector
  .reconstruction-workspace__workspace-card h3,
.reconstruction-workspace__aux-inspector
  .reconstruction-workspace__workspace-card-title {
  font-size: 12px !important;
  font-weight: 700 !important;
  line-height: 1.15 !important;
  letter-spacing: .015em !important;
}

/* Card descriptions/subtitles. */
.reconstruction-workspace__aux-inspector
  .premium-investigation-card__header p,
.reconstruction-workspace__aux-inspector
  .reconstruction-workspace__workspace-card p,
.reconstruction-workspace__aux-inspector
  .premium-investigation-card__subtitle {
  font-size: 10px !important;
  line-height: 1.35 !important;
}

/* Form labels. */
.reconstruction-workspace__aux-inspector
  label,
.reconstruction-workspace__aux-inspector
  .reconstruction-workspace__workspace-field > span,
.reconstruction-workspace__aux-inspector
  .reconstruction-workspace__workspace-field > label {
  font-size: 9.5px !important;
  line-height: 1.2 !important;
}

/* Input/select/textarea values. */
.reconstruction-workspace__aux-inspector
  input,
.reconstruction-workspace__aux-inspector
  select,
.reconstruction-workspace__aux-inspector
  textarea,
.reconstruction-workspace__aux-inspector
  button {
  font-size: 10px !important;
}

/* Read-only values / metric values. */
.reconstruction-workspace__aux-inspector
  strong,
.reconstruction-workspace__aux-inspector
  output,
.reconstruction-workspace__aux-inspector
  .premium-investigation-card__value {
  font-size: 10.5px !important;
  line-height: 1.25 !important;
}

/* Help/muted text. */
.reconstruction-workspace__aux-inspector
  small,
.reconstruction-workspace__aux-inspector
  .text-sm,
.reconstruction-workspace__aux-inspector
  .text-xs {
  font-size: 9px !important;
  line-height: 1.35 !important;
}

/* Reduce oversized header icon blocks. */
.reconstruction-workspace__aux-inspector
  .premium-investigation-card__header
  svg {
  width: 15px !important;
  height: 15px !important;
}

.reconstruction-workspace__aux-inspector
  .premium-investigation-card__header
  > div:first-child {
  min-width: 30px !important;
  min-height: 30px !important;
}

/* Tighter cards so the right panel reads like Blender Properties. */
.reconstruction-workspace__aux-inspector
  .premium-investigation-card__header {
  padding: 6px 7px !important;
}

.reconstruction-workspace__aux-inspector
  .premium-investigation-card__body {
  padding: 7px !important;
}

.reconstruction-workspace__aux-inspector
  .reconstruction-workspace__workspace-card {
  font-size: 10px !important;
}

/* Give scroll targets clearance below sticky horizontal tabs. */
.reconstruction-workspace__aux-inspector
  .premium-investigation-card,
.reconstruction-workspace__aux-inspector
  .reconstruction-workspace__workspace-card {
  scroll-margin-top: 38px !important;
}

${CSS_END}
`;

css =
  `${css.trimEnd()}\n\n${cssPatch.trim()}\n`;

/* ------------------------------------------------------------------ */
/* Verification.                                                       */
/* ------------------------------------------------------------------ */

for (const token of [
  "workspaceInvestigationTab",
  "handleWorkspaceInvestigationTab",
  "reconstruction-workspace__aux-horizontal-tabs",
  '["case", "Case", "Case Setup"]',
  '["physics", "Physics", "Deterministic Simulation"]',
]) {
  if (!editor.includes(token)) {
    fail(
      `Editor verification failed: ${token}`,
    );
  }
}

for (const token of [
  CSS_START,
  ".reconstruction-workspace__aux-horizontal-tabs",
  "font-size: 12px !important",
  "scroll-margin-top: 38px !important",
]) {
  if (!css.includes(token)) {
    fail(
      `CSS verification failed: ${token}`,
    );
  }
}

try {
  const require = createRequire(import.meta.url);
  const ts = require("typescript");

  const sf = ts.createSourceFile(
    "AccidentReconstructionEditor.tsx",
    editor,
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
    "Workspace horizontal tabs TSX audit: PASS",
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

console.log("");
console.log(
  "RoadSafe Workspace horizontal-tabs + compact-type fix installed.",
);
console.log("");
console.log(
  "Workspace & Investigation now gets a horizontal sticky sub-tab bar:");
console.log(
  "  Case | Scene | Objects | Impact | Physics | Audit | Hypotheses | Evidence | Notes");
console.log("");
console.log(
  "Large migrated-card typography was reduced only inside Workspace & Investigation.");
console.log("");
console.log(
  "Refresh/start:");
console.log(
  "  npm run dev");
console.log("");
console.log(
  "Rollback:");
console.log(
  "  node revoke-workspace-horizontal-tabs-compact-type-v1.mjs");
