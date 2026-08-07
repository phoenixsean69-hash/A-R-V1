import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const editorPath = path.join(root, "src/components/reconstruction/AccidentReconstructionEditor.tsx");
const cssPath = path.join(root, "src/components/reconstruction/reconstructionBottomDock.css");
const backupRoot = path.join(root, ".roadsafe-ui-backup");
const statePath = path.join(backupRoot, "last-speed-limit-width-fix-v2.json");

const CSS_START = "/* [RoadSafe:SpeedLimitWidthFixV1:start] */";
const CSS_END = "/* [RoadSafe:SpeedLimitWidthFixV1:end] */";

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(packagePath)) {
  fail("Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1");
}

const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
if (pkg.name !== "roadsafe-ar") {
  fail(`Expected package \"roadsafe-ar\", found \"${pkg.name ?? "unknown"}\".`);
}

for (const requiredPath of [editorPath, cssPath]) {
  if (!fs.existsSync(requiredPath)) {
    fail(`Required file missing: ${requiredPath}`);
  }
}

let editor = fs.readFileSync(editorPath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");
const originalEditor = editor;
const originalCss = css;

for (const token of [
  'className="reconstruction-workspace__aux-inspector"',
  'Workspace, Evidence & Investigation',
  'className="reconstruction-workspace__aux-inspector-content"',
]) {
  if (!editor.includes(token)) {
    fail(`Expected current right-panel marker missing: ${token}`);
  }
}

if (!editor.includes('roadsafeSpeedLimitWidthApplied')) {
  const insertAnchor = '  const handleDurationChange = (durationSeconds: number) => {';
  if (!editor.includes(insertAnchor)) {
    fail('Could not locate handleDurationChange insertion anchor.');
  }

  const effectBlock = `  useEffect(() => {\n    if (!workspaceSettingsOpen) return;\n\n    const applySpeedLimitWidth = () => {\n      const inspector = document.querySelector<HTMLElement>(\n        ".reconstruction-workspace__aux-inspector",\n      );\n\n      if (!inspector) return;\n\n      const labelCandidates = Array.from(\n        inspector.querySelectorAll<HTMLElement>(\n          "label, span, div, p, strong",\n        ),\n      );\n\n      const label = labelCandidates.find((element) =>\n        element.textContent?.trim().toLowerCase() === "speed limit",\n      );\n\n      if (!label) return;\n\n      let row = label.closest<HTMLElement>(\n        ".premium-investigation-card__field, .reconstruction-workspace__workspace-field, .grid, .flex, [class*='field'], [class*='row']",\n      );\n\n      if (!row) {\n        let current = label.parentElement;\n\n        while (current && current !== inspector) {\n          if (current.querySelector("input, select, textarea")) {\n            row = current;\n            break;\n          }\n\n          current = current.parentElement;\n        }\n      }\n\n      if (!row) return;\n\n      row.dataset.roadsafeSpeedLimitWidthApplied = "true";\n\n      const control =\n        row.querySelector<HTMLElement>(\n          "input[type='number'], input[inputmode='numeric'], input[inputmode='decimal'], input",\n        ) ?? null;\n\n      if (!control) return;\n\n      control.dataset.roadsafeSpeedLimitInput = "true";\n\n      const controlWrapper = control.parentElement as HTMLElement | null;\n\n      if (controlWrapper) {\n        controlWrapper.dataset.roadsafeSpeedLimitControl = "true";\n      }\n\n      const siblings = Array.from(row.children) as HTMLElement[];\n\n      siblings.forEach((child) => {\n        if (child === control || child.contains(control)) return;\n\n        const text = child.textContent?.trim().toLowerCase() ?? "";\n\n        if (text === "km/h" || text === "kmh") {\n          child.dataset.roadsafeSpeedLimitUnit = "true";\n        }\n      });\n    };\n\n    applySpeedLimitWidth();\n\n    const timer = window.setTimeout(\n      applySpeedLimitWidth,\n      120,\n    );\n\n    return () => {\n      window.clearTimeout(timer);\n    };\n  }, [workspaceSettingsOpen, workspaceInvestigationTab, activeReconstructionView]);\n\n`;

  editor = editor.replace(insertAnchor, effectBlock + insertAnchor);
}

const previousStart = css.indexOf(CSS_START);
if (previousStart >= 0) {
  const previousEnd = css.indexOf(CSS_END, previousStart);
  if (previousEnd < 0) {
    fail('Found incomplete previous SpeedLimitWidthFix block.');
  }
  css = css.slice(0, previousStart) + css.slice(previousEnd + CSS_END.length);
}

const cssPatch = `\n${CSS_START}\n.reconstruction-workspace__aux-inspector [data-roadsafe-speed-limit-width-applied="true"] {\n  align-items: center !important;\n}\n\n.reconstruction-workspace__aux-inspector [data-roadsafe-speed-limit-control="true"] {\n  min-width: 110px !important;\n  width: min(100%, 140px) !important;\n  max-width: 140px !important;\n  flex: 0 0 140px !important;\n}\n\n.reconstruction-workspace__aux-inspector [data-roadsafe-speed-limit-input="true"] {\n  min-width: 92px !important;\n  width: 100% !important;\n  max-width: none !important;\n}\n\n.reconstruction-workspace__aux-inspector [data-roadsafe-speed-limit-unit="true"] {\n  min-width: 46px !important;\n  white-space: nowrap !important;\n  text-align: center !important;\n}\n\n/* fallback: widen compact numeric fields inside Workspace & Investigation */\n.reconstruction-workspace__aux-inspector input[type="number"],\n.reconstruction-workspace__aux-inspector input[inputmode="numeric"],\n.reconstruction-workspace__aux-inspector input[inputmode="decimal"] {\n  min-width: 88px !important;\n}\n${CSS_END}\n`;

css = `${css.trimEnd()}\n\n${cssPatch}`;

for (const token of [
  'roadsafeSpeedLimitWidthApplied',
  'roadsafeSpeedLimitInput',
  'roadsafeSpeedLimitControl',
  'workspaceInvestigationTab',
]) {
  if (!editor.includes(token)) {
    fail(`Editor verification failed: ${token}`);
  }
}

for (const token of [
  CSS_START,
  '[data-roadsafe-speed-limit-control="true"]',
  'min-width: 92px !important;',
]) {
  if (!css.includes(token)) {
    fail(`CSS verification failed: ${token}`);
  }
}

try {
  const require = createRequire(import.meta.url);
  const ts = require('typescript');
  const sf = ts.createSourceFile(
    'AccidentReconstructionEditor.tsx',
    editor,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const diagnostics = sf.parseDiagnostics ?? [];
  if (diagnostics.length > 0) {
    const details = diagnostics.slice(0, 12).map((diagnostic) => {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      if (typeof diagnostic.start !== 'number') return message;
      const location = sf.getLineAndCharacterOfPosition(diagnostic.start);
      return `line ${location.line + 1}, column ${location.character + 1}: ${message}`;
    }).join('\n');
    fail(`TSX parse audit failed:\n${details}`);
  }
  console.log('Speed limit width TSX audit: PASS');
} catch (error) {
  if (String(error).includes("Cannot find module 'typescript'")) {
    console.warn('TypeScript parser unavailable; structural guards passed.');
  } else {
    throw error;
  }
}

fs.mkdirSync(backupRoot, { recursive: true });
fs.writeFileSync(statePath, JSON.stringify({
  installedAt: new Date().toISOString(),
  editorPath: path.relative(root, editorPath),
  cssPath: path.relative(root, cssPath),
  originalEditor,
  originalCss,
}, null, 2), 'utf8');

fs.writeFileSync(editorPath, editor, 'utf8');
fs.writeFileSync(cssPath, css, 'utf8');

console.log('');
console.log('RoadSafe speed-limit width fix V2 installed.');
console.log('The compact Speed limit field inside Workspace & Investigation was widened.');
console.log('');
console.log('Refresh/start:');
console.log('  npm run dev');
console.log('');
console.log('Rollback:');
console.log('  node revoke-speed-limit-width-fix-v2.mjs');
