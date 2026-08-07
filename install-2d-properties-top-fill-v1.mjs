import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const packagePath = path.join(root, "package.json");
const cssPath = path.join(
  root,
  "src/styles/blenderColorGuard.css",
);
const payloadPath = path.join(
  scriptDir,
  "2d-properties-top-fill-v1.css",
);

const backupRoot = path.join(
  root,
  ".roadsafe-ui-backup",
);
const statePath = path.join(
  backupRoot,
  "last-2d-properties-top-fill-v1.json",
);

const START =
  "/* [RoadSafe:2DPropertiesTopFillV1:start] */";
const END =
  "/* [RoadSafe:2DPropertiesTopFillV1:end] */";

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

if (!fs.existsSync(cssPath)) {
  fail(
    "Could not find src/styles/blenderColorGuard.css.",
  );
}

if (!fs.existsSync(payloadPath)) {
  fail(
    "Missing 2d-properties-top-fill-v1.css beside installer.",
  );
}

const original =
  fs.readFileSync(cssPath, "utf8");

let source = original;

/* Remove prior copy for idempotence. */
const oldStart = source.indexOf(START);

if (oldStart >= 0) {
  const oldEnd =
    source.indexOf(
      END,
      oldStart,
    );

  if (oldEnd < 0) {
    fail(
      "Found incomplete previous 2D top-fill block. No file changed.",
    );
  }

  source =
    source.slice(0, oldStart) +
    source.slice(
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
    "Top-fill CSS payload markers are invalid.",
  );
}

const opens =
  (payload.match(/\{/g) ?? []).length;

const closes =
  (payload.match(/\}/g) ?? []).length;

if (opens !== closes) {
  fail(
    `CSS brace mismatch: ${opens} opening / ${closes} closing.`,
  );
}

/*
 * Require the installed 2D Blender panel from V7.
 * We intentionally don't patch an unrelated UI.
 */
if (
  !source.includes(
    "reconstruction-workspace__blender-properties--2d-v5",
  )
) {
  fail(
    "The Blender-style 2D Properties CSS from V7 was not found. No file changed.",
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
      cssPath:
        path.relative(
          root,
          cssPath,
        ),
      original,
    },
    null,
    2,
  ),
  "utf8",
);

source =
  `${source.trimEnd()}\n\n${payload}\n`;

fs.writeFileSync(
  cssPath,
  source,
  "utf8",
);

console.log("");
console.log(
  "RoadSafe 2D Properties top-fill fix installed.",
);
console.log("");
console.log(
  "The right Properties editor now starts at the TOP beside the icon rail.",
);
console.log("");
console.log(
  "No TSX or application logic changed.",
);
console.log("");
console.log(
  "Refresh/start:",
);
console.log(
  "  npm run dev",
);
console.log("");
console.log(
  "Rollback:",
);
console.log(
  "  node revoke-2d-properties-top-fill-v1.mjs",
);
