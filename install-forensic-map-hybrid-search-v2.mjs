import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root =
  process.cwd();

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

const mapPath =
  path.join(
    root,
    "src/components/cases/ForensicAreaMap.tsx",
  );

const cssPath =
  path.join(
    root,
    "src/components/cases/forensicCaseAreaWizard.css",
  );

const payloadMapPath =
  path.join(
    scriptDir,
    "ForensicAreaMap.tsx",
  );

const payloadCssPath =
  path.join(
    scriptDir,
    "forensic-map-hybrid-search-v2.css",
  );

const backupRoot =
  path.join(
    root,
    ".roadsafe-ui-backup",
  );

const statePath =
  path.join(
    backupRoot,
    "last-forensic-map-hybrid-search-v2.json",
  );

const buildLogPath =
  path.join(
    backupRoot,
    "forensic-map-hybrid-search-v2-build.log",
  );

const CSS_START =
  "/* [RoadSafe:ForensicMapHybridSearchV2:start] */";

const CSS_END =
  "/* [RoadSafe:ForensicMapHybridSearchV2:end] */";

function fail(
  message,
) {
  console.error(
    message,
  );

  process.exit(
    1,
  );
}

if (
  !fs.existsSync(
    packagePath,
  )
) {
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
    `Expected roadsafe-ar, found ${pkg.name ?? "unknown"}.`,
  );
}

for (
  const required of [
    mapPath,
    cssPath,
    payloadMapPath,
    payloadCssPath,
  ]
) {
  if (
    !fs.existsSync(
      required,
    )
  ) {
    fail(
      `Required file missing: ${required}`,
    );
  }
}

const originalMap =
  fs.readFileSync(
    mapPath,
    "utf8",
  );

const originalCss =
  fs.readFileSync(
    cssPath,
    "utf8",
  );

const nextMap =
  fs.readFileSync(
    payloadMapPath,
    "utf8",
  );

let nextCss =
  originalCss;

const oldStart =
  nextCss.indexOf(
    CSS_START,
  );

if (
  oldStart >= 0
) {
  const oldEnd =
    nextCss.indexOf(
      CSS_END,
      oldStart,
    );

  if (
    oldEnd < 0
  ) {
    fail(
      "Found an incomplete previous hybrid/search CSS patch.",
    );
  }

  nextCss =
    nextCss.slice(
      0,
      oldStart,
    ) +
    nextCss.slice(
      oldEnd +
      CSS_END.length,
    );
}

nextCss =
  `${nextCss.trimEnd()}\n\n${fs
    .readFileSync(
      payloadCssPath,
      "utf8",
    )
    .trim()}\n`;

for (
  const token of [
    "LocationSearchService",
    "createHybridStyle",
    "World_Transportation",
    "World_Boundaries_and_Places",
    "handleSearch",
    "selectSearchResult",
    "Search road, city, junction or place",
  ]
) {
  if (
    !nextMap.includes(
      token,
    )
  ) {
    fail(
      `Map verification failed: ${token}`,
    );
  }
}

for (
  const token of [
    CSS_START,
    ".roadsafe-forensic-map__search",
    ".roadsafe-forensic-map__search-results",
  ]
) {
  if (
    !nextCss.includes(
      token,
    )
  ) {
    fail(
      `CSS verification failed: ${token}`,
    );
  }
}

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
      "ForensicAreaMap.tsx",
      nextMap,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

  const diagnostics =
    sourceFile.parseDiagnostics ??
    [];

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
          (
            diagnostic,
          ) => {
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
              sourceFile.getLineAndCharacterOfPosition(
                diagnostic.start,
              );

            return `line ${position.line + 1}:${position.character + 1} ${message}`;
          },
        )
        .join(
          "\n",
        );

    fail(
      `ForensicAreaMap TSX parse failed:\n${details}`,
    );
  }

  console.log(
    "ForensicAreaMap TSX parse audit: PASS",
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
      "TypeScript parser unavailable; continuing to full build.",
    );
  } else {
    throw error;
  }
}

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
      mapPath:
        path.relative(
          root,
          mapPath,
        ),
      cssPath:
        path.relative(
          root,
          cssPath,
        ),
      originalMap,
      originalCss,
    },
    null,
    2,
  ),
  "utf8",
);

function restore() {
  fs.writeFileSync(
    mapPath,
    originalMap,
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
  mapPath,
  nextMap,
  "utf8",
);

fs.writeFileSync(
  cssPath,
  nextCss,
  "utf8",
);

console.log(
  "UPDATED ForensicAreaMap: hybrid labels + Zimbabwe location search.",
);

console.log("");
console.log(
  "Running full build...",
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
      cwd:
        root,
      encoding:
        "utf8",
      shell:
        false,
      env:
        process.env,
    },
  );

const output =
  [
    "RoadSafe Forensic Map Hybrid + Search V2",
    "========================================",
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
    build.stdout ??
      "",
    "",
    "STDERR",
    "------",
    build.stderr ??
      "",
  ].join(
    "\n",
  );

fs.writeFileSync(
  buildLogPath,
  output,
  "utf8",
);

if (
  build.stdout
) {
  process.stdout.write(
    build.stdout,
  );
}

if (
  build.stderr
) {
  process.stderr.write(
    build.stderr,
  );
}

if (
  build.status ===
    null ||
  build.status !==
    0
) {
  console.error("");
  console.error(
    "Build failed. Restoring the map and CSS...",
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
  "RoadSafe Forensic Map Hybrid + Search V2 installed successfully.",
);

console.log("");
console.log(
  "Hybrid now layers:",
);

console.log(
  "  Esri imagery + transportation reference + cities/place labels",
);

console.log("");
console.log(
  "Search now uses the repo's Zimbabwe LocationSearchService.",
);

console.log(
  "Selecting a result moves the accident anchor and clears stale core geometry.",
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
  "  node revoke-forensic-map-hybrid-search-v2.mjs",
);
