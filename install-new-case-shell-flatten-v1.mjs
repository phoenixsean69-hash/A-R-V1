import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
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

const pagePath =
  path.join(
    root,
    "src/pages/AccidentCaseFormPage.tsx",
  );

const cssPath =
  path.join(
    root,
    "src/pages/accidentCaseFormPage.css",
  );

const payloadPage =
  path.join(
    scriptDir,
    "AccidentCaseFormPage.tsx",
  );

const payloadCss =
  path.join(
    scriptDir,
    "accidentCaseFormPage.css",
  );

const backupRoot =
  path.join(
    root,
    ".roadsafe-ui-backup",
  );

const statePath =
  path.join(
    backupRoot,
    "last-new-case-shell-flatten-v1.json",
  );

const buildLogPath =
  path.join(
    backupRoot,
    "new-case-shell-flatten-v1-build.log",
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

if (
  pkg.name !==
  "roadsafe-ar"
) {
  fail(
    `Expected roadsafe-ar, found ${pkg.name ?? "unknown"}.`,
  );
}

for (const required of [
  pagePath,
  payloadPage,
  payloadCss,
]) {
  if (!fs.existsSync(required)) {
    fail(
      `Required file missing: ${required}`,
    );
  }
}

const currentPage =
  fs.readFileSync(
    pagePath,
    "utf8",
  );

for (const marker of [
  "AccidentCaseFormPage",
  "AccidentCaseService",
  "CaseForm",
]) {
  if (!currentPage.includes(marker)) {
    fail(
      `Unexpected AccidentCaseFormPage structure: ${marker} missing.`,
    );
  }
}

if (
  !currentPage.includes(
    "ForensicCaseAreaWizard",
  )
) {
  fail(
    "ForensicCaseAreaWizard is not active. Install Forensic Geospatial Pipeline Phase 1 first.",
  );
}

const originalPage =
  currentPage;

const originalCss =
  fs.existsSync(
    cssPath,
  )
    ? fs.readFileSync(
        cssPath,
        "utf8",
      )
    : null;

const nextPage =
  fs.readFileSync(
    payloadPage,
    "utf8",
  );

const nextCss =
  fs.readFileSync(
    payloadCss,
    "utf8",
  );

for (const token of [
  "roadsafe-new-case-page",
  "roadsafe-new-case-page__back",
  "<ForensicCaseAreaWizard",
  "Create a Location-Based Accident Case",
]) {
  if (!nextPage.includes(token)) {
    fail(
      `Page payload verification failed: ${token}`,
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
      "AccidentCaseFormPage.tsx",
      nextPage,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

  const diagnostics =
    sourceFile.parseDiagnostics ??
    [];

  if (diagnostics.length > 0) {
    const details =
      diagnostics
        .slice(0, 20)
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
        })
        .join("\n");

    fail(
      `AccidentCaseFormPage TSX parse failed:\n${details}`,
    );
  }

  console.log(
    "New Case flattened shell TSX parse audit: PASS",
  );
} catch (error) {
  if (
    String(error).includes(
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
      pagePath:
        path.relative(
          root,
          pagePath,
        ),
      cssPath:
        path.relative(
          root,
          cssPath,
        ),
      originalPage,
      originalCss,
    },
    null,
    2,
  ),
  "utf8",
);

function restore() {
  fs.writeFileSync(
    pagePath,
    originalPage,
    "utf8",
  );

  if (originalCss === null) {
    fs.rmSync(
      cssPath,
      {
        force: true,
      },
    );
  } else {
    fs.writeFileSync(
      cssPath,
      originalCss,
      "utf8",
    );
  }

  fs.rmSync(
    statePath,
    {
      force: true,
    },
  );
}

fs.writeFileSync(
  pagePath,
  nextPage,
  "utf8",
);

fs.writeFileSync(
  cssPath,
  nextCss,
  "utf8",
);

console.log(
  "FLATTENED New Case page into the AppShell centre workspace.",
);

console.log(
  "RESTYLED page title + Back control for the RoadSafe workstation theme.",
);

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
    "RoadSafe New Case Shell Flatten V1",
    "=================================",
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
  ].join("\n");

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
    "Build failed. Restoring the original page shell...",
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
  "RoadSafe New Case Shell Flatten V1 installed successfully.",
);

console.log("");
console.log(
  "New Case now mounts directly in the AppShell centre with no legacy max-width/page card wrapper.",
);

console.log(
  "The title and Back control now use the workstation palette.",
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
  "  node revoke-new-case-shell-flatten-v1.mjs",
);
