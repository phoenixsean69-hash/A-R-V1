import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const scriptDir = path.dirname(
  fileURLToPath(import.meta.url),
);

const packagePath = path.join(
  root,
  "package.json",
);

const editorPath = path.join(
  root,
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
);

const colourGuardPath = path.join(
  root,
  "src/styles/blenderColorGuard.css",
);

const payloadPath = path.join(
  scriptDir,
  "blender-bottom-timeline-dock-v2.css",
);

const backupRoot = path.join(
  root,
  ".roadsafe-ui-backup",
);

const statePath = path.join(
  backupRoot,
  "last-blender-bottom-timeline-dock-v2.json",
);

const START =
  "/* [RoadSafe:BlenderBottomTimelineDockV2:start] */";

const END =
  "/* [RoadSafe:BlenderBottomTimelineDockV2:end] */";

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
  payloadPath,
]) {
  if (!fs.existsSync(requiredPath)) {
    fail(
      `Required file missing: ${requiredPath}`,
    );
  }
}

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

/*
 * V2 is intentionally applied ON TOP of Timeline Dock V1.
 */
for (const marker of [
  "reconstruction-workspace__primary-editor",
  "reconstruction-workspace__viewport-region",
  "reconstruction-workspace__timeline-dock",
  "timelineDockHeight",
  "timelineDockCollapsed",
]) {
  if (!originalEditor.includes(marker)) {
    fail(
      `Timeline Dock V1 marker missing: ${marker}. No files changed.`,
    );
  }
}

let editor = originalEditor;
let colourGuard = originalColourGuard;

/*
 * Start with a more Blender-like default height on the next render/reload.
 * If this line has already been changed, leave it alone.
 */
editor = editor.replace(
  /const \[timelineDockHeight, setTimelineDockHeight\]\s*=\s*useState\(\s*220\s*\);/,
  `const [timelineDockHeight, setTimelineDockHeight] = useState(176);`,
);

/*
 * Tighten the drag ceiling so the timeline cannot accidentally occupy most
 * of the screen. Preserve the V1 drag behavior itself.
 */
editor = editor.replace(
  /Math\.min\(\s*520,\s*window\.innerHeight\s*\*\s*0\.58\s*\)/,
  `Math.min(340, window.innerHeight * 0.38)`,
);

/*
 * Keep the minimum usable but compact.
 */
editor = editor.replace(
  /startHeight \+ \(startY - pointerEvent\.clientY\),\s*130,\s*maximumHeight,/,
  `startHeight + (startY - pointerEvent.clientY),
          126,
          maximumHeight,`,
);

/* Idempotent CSS replacement. */
const oldStart =
  colourGuard.indexOf(START);

if (oldStart >= 0) {
  const oldEnd =
    colourGuard.indexOf(
      END,
      oldStart,
    );

  if (oldEnd < 0) {
    fail(
      "Found incomplete previous V2 CSS block. No files changed.",
    );
  }

  colourGuard =
    colourGuard.slice(0, oldStart) +
    colourGuard.slice(
      oldEnd + END.length,
    );
}

const payload =
  fs.readFileSync(
    payloadPath,
    "utf8",
  ).trim();

if (
  !payload.startsWith(START) ||
  !payload.endsWith(END)
) {
  fail(
    "V2 timeline CSS payload markers are invalid.",
  );
}

const openBraces =
  (payload.match(/\{/g) ?? []).length;

const closeBraces =
  (payload.match(/\}/g) ?? []).length;

if (openBraces !== closeBraces) {
  fail(
    `V2 CSS brace mismatch: ${openBraces} opening / ${closeBraces} closing.`,
  );
}

colourGuard =
  `${colourGuard.trimEnd()}\n\n${payload}\n`;

/*
 * Do not allow V2 to duplicate the actual AccidentTimeline component.
 */
const timelineCount =
  (editor.match(/<AccidentTimeline\b/g) ?? []).length;

if (timelineCount !== 1) {
  fail(
    `Expected one shared AccidentTimeline, found ${timelineCount}. No files changed.`,
  );
}

fs.mkdirSync(
  backupRoot,
  { recursive: true },
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
  "RoadSafe Blender bottom Timeline Dock V2 installed.",
);
console.log("");
console.log(
  "V2 correction:",
);
console.log(
  "- reconstruction is now a full-height editor shell;",
);
console.log(
  "- scene + timeline fill the visible editor body;",
);
console.log(
  "- timeline owns the actual bottom edge of the active editor;",
);
console.log(
  "- Nodes and other secondary panels no longer appear underneath it in the initial editor viewport;",
);
console.log(
  "- default timeline height reduced to 176px;",
);
console.log(
  "- timeline resize ceiling reduced to 340px / 38vh;",
);
console.log(
  "- duplicate scrubber row hidden;",
);
console.log(
  "- tracks and headers compacted closer to Blender.",
);
console.log("");
console.log(
  "Refresh / start:",
);
console.log(
  "  npm run dev",
);
console.log("");
console.log(
  "Rollback V2 only:",
);
console.log(
  "  node revoke-blender-bottom-timeline-dock-v2.mjs",
);
