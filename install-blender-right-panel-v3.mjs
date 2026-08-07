import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const packagePath =
  path.join(root, "package.json");

const targetPath =
  path.join(
    root,
    "src/styles/blenderColorGuard.css",
  );

const payloadPath =
  path.join(
    scriptDir,
    "blender-right-panel-v3.css",
  );

const backupRoot =
  path.join(
    root,
    ".roadsafe-ui-backup",
  );

const backupPath =
  path.join(
    backupRoot,
    "blender-right-panel-v3.json",
  );

const START =
  "/* [RoadSafe:BlenderRightPropertiesV3:start] */";

const END =
  "/* [RoadSafe:BlenderRightPropertiesV3:end] */";

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

if (!fs.existsSync(targetPath)) {
  fail(
    "Could not find src/styles/blenderColorGuard.css.",
  );
}

if (!fs.existsSync(payloadPath)) {
  fail(
    "Missing blender-right-panel-v3.css beside installer.",
  );
}

const original =
  fs.readFileSync(
    targetPath,
    "utf8",
  );

let working = original;

const oldStart =
  working.indexOf(START);

if (oldStart >= 0) {
  const oldEnd =
    working.indexOf(
      END,
      oldStart,
    );

  if (oldEnd < 0) {
    fail(
      "Found an incomplete previous V3 marker block. No files changed.",
    );
  }

  working =
    working.slice(0, oldStart) +
    working.slice(
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
    "CSS payload markers are invalid.",
  );
}

const next =
  `${working.trimEnd()}\n\n${payload}\n`;

const markerCount =
  next.split(START).length - 1;

if (markerCount !== 1) {
  fail(
    `Expected exactly one V3 marker block, found ${markerCount}.`,
  );
}

/*
 * Lightweight CSS corruption guards.
 * This is intentionally not a TypeScript/build operation.
 */
const openBraces =
  (payload.match(/\{/g) ?? []).length;

const closeBraces =
  (payload.match(/\}/g) ?? []).length;

if (openBraces !== closeBraces) {
  fail(
    `CSS brace mismatch: ${openBraces} opening / ${closeBraces} closing.`,
  );
}

fs.mkdirSync(
  backupRoot,
  { recursive: true },
);

fs.writeFileSync(
  backupPath,
  JSON.stringify(
    {
      installedAt:
        new Date().toISOString(),
      target:
        path.relative(
          root,
          targetPath,
        ),
      original,
    },
    null,
    2,
  ),
  "utf8",
);

fs.writeFileSync(
  targetPath,
  next,
  "utf8",
);

const written =
  fs.readFileSync(
    targetPath,
    "utf8",
  );

const required = [
  START,
  END,
  ".reconstruction-workspace__stage-grid--3d",
  ".reconstruction-workspace__segmented-grid",
  ".reconstruction-workspace__layer-list",
  ".reconstruction-workspace__telemetry-grid",
  "#e8872d",
];

for (const token of required) {
  if (
    !written
      .toLowerCase()
      .includes(
        token.toLowerCase(),
      )
  ) {
    fs.writeFileSync(
      targetPath,
      original,
      "utf8",
    );

    fail(
      `CSS verification failed for token: ${token}. Original file restored.`,
    );
  }
}

console.log("");
console.log(
  "RoadSafe Blender right panel V3 installed.",
);
console.log("");
console.log(
  "Changed only:",
);
console.log(
  "  src/styles/blenderColorGuard.css",
);
console.log("");
console.log(
  "No TSX, React, physics, models, timeline, package.json or imports changed.",
);
console.log("");
console.log(
  "Start/refresh:",
);
console.log(
  "  npm run dev",
);
console.log("");
console.log(
  "Rollback:",
);
console.log(
  "  node revoke-blender-right-panel-v3.mjs",
);
