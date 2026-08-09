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

const checklistPath =
  path.join(
    root,
    "src/components/cases/CaseCompletionChecklist.tsx",
  );

const wizardPath =
  path.join(
    root,
    "src/components/cases/ForensicCaseAreaWizard.tsx",
  );

const wizardCssPath =
  path.join(
    root,
    "src/components/cases/forensicCaseAreaWizard.css",
  );

const checkpointServicePath =
  path.join(
    root,
    "src/services/forensicWizardCheckpointService.ts",
  );

const payloadWizardPath =
  path.join(
    scriptDir,
    "ForensicCaseAreaWizard.tsx",
  );

const payloadServicePath =
  path.join(
    scriptDir,
    "forensicWizardCheckpointService.ts",
  );

const payloadCssPath =
  path.join(
    scriptDir,
    "forensic-wizard-checkpoints-v1.css",
  );

const backupRoot =
  path.join(
    root,
    ".roadsafe-ui-backup",
  );

const statePath =
  path.join(
    backupRoot,
    "last-checklist-theme-wizard-checkpoints-v1.json",
  );

const buildLogPath =
  path.join(
    backupRoot,
    "checklist-theme-wizard-checkpoints-v1-build.log",
  );

const CSS_START =
  "/* [RoadSafe:ForensicWizardCheckpointsV1:start] */";

const CSS_END =
  "/* [RoadSafe:ForensicWizardCheckpointsV1:end] */";

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
    checklistPath,
    wizardPath,
    wizardCssPath,
    payloadWizardPath,
    payloadServicePath,
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

const originalChecklist =
  fs.readFileSync(
    checklistPath,
    "utf8",
  );

const originalWizard =
  fs.readFileSync(
    wizardPath,
    "utf8",
  );

const originalWizardCss =
  fs.readFileSync(
    wizardCssPath,
    "utf8",
  );

const originalCheckpointService =
  fs.existsSync(
    checkpointServicePath,
  )
    ? fs.readFileSync(
        checkpointServicePath,
        "utf8",
      )
    : null;

if (
  !originalWizard.includes(
    "ForensicScenePipelineService",
  ) ||
  !originalWizard.includes(
    "ForensicAreaMap",
  )
) {
  fail(
    "ForensicCaseAreaWizard structure is not recognised. No files changed.",
  );
}

/* ========================================================================== */
/* Completion checklist theme repair.                                         */
/* ========================================================================== */

let checklist =
  originalChecklist;

const themeReplacements =
  new Map([
    [
      "#081918_0%,#091321_74%",
      "#303030_0%,#292929_100%",
    ],
    [
      "#18150d_0%,#091321_74%",
      "#302d29_0%,#292929_100%",
    ],
    [
      "#55b9aa",
      "#879baa",
    ],
    [
      "#9ae0d4",
      "#b7c3cc",
    ],
    [
      "#c49a46",
      "#e8872d",
    ],
    [
      "#d9bd78",
      "#d6a06c",
    ],
    [
      "#6d5523",
      "#67513c",
    ],
    [
      "#241d10",
      "#362f28",
    ],
    [
      "#4d4023",
      "#50473f",
    ],
    [
      "#705c2b",
      "#6b5541",
    ],
    [
      "#bba56f",
      "#c3a486",
    ],
    [
      "rgba(85,185,170,0.35)",
      "rgba(135,155,170,0.22)",
    ],
    [
      "rgba(77,140,245,0.38)",
      "rgba(232,135,45,0.24)",
    ],
  ]);

for (
  const [
    before,
    after,
  ] of themeReplacements
) {
  checklist =
    checklist
      .split(
        before,
      )
      .join(
        after,
      );
}

for (
  const forbidden of [
    "#081918",
    "#091321",
    "#55b9aa",
    "#c49a46",
    "#241d10",
    "#d9bd78",
  ]
) {
  if (
    checklist.includes(
      forbidden,
    )
  ) {
    fail(
      `Off-theme checklist colour survived: ${forbidden}. No files changed.`,
    );
  }
}

console.log(
  "PATCHED CaseCompletionChecklist to workstation gray / dull-blue / RoadSafe orange.",
);

/* ========================================================================== */
/* Wizard + checkpoint service.                                               */
/* ========================================================================== */

const nextWizard =
  fs.readFileSync(
    payloadWizardPath,
    "utf8",
  );

const nextCheckpointService =
  fs.readFileSync(
    payloadServicePath,
    "utf8",
  );

let nextWizardCss =
  originalWizardCss;

const oldStart =
  nextWizardCss.indexOf(
    CSS_START,
  );

if (
  oldStart >=
  0
) {
  const oldEnd =
    nextWizardCss.indexOf(
      CSS_END,
      oldStart,
    );

  if (
    oldEnd <
    0
  ) {
    fail(
      "Found an incomplete previous checkpoint CSS block. No files changed.",
    );
  }

  nextWizardCss =
    nextWizardCss.slice(
      0,
      oldStart,
    ) +
    nextWizardCss.slice(
      oldEnd +
        CSS_END.length,
    );
}

nextWizardCss =
  `${nextWizardCss.trimEnd()}\n\n${fs
    .readFileSync(
      payloadCssPath,
      "utf8",
    )
    .trim()}\n`;

for (
  const token of [
    "ForensicWizardCheckpointService",
    "completedThrough",
    "checkpointResumeStep",
    "commitCheckpoint",
    "Area saved · Build ready to retry",
    "RoadSafe Forensic Wizard Checkpoint V1",
  ]
) {
  if (
    !nextWizard.includes(
      token,
    ) &&
    !nextCheckpointService.includes(
      token,
    )
  ) {
    fail(
      `Checkpoint verification failed: ${token}. No files changed.`,
    );
  }
}

/* ========================================================================== */
/* Parse all transformed TS/TSX before write.                                 */
/* ========================================================================== */

try {
  const require =
    createRequire(
      import.meta.url,
    );

  const ts =
    require(
      "typescript",
    );

  const parseTargets = [
    [
      "CaseCompletionChecklist.tsx",
      checklist,
      ts.ScriptKind.TSX,
    ],
    [
      "ForensicCaseAreaWizard.tsx",
      nextWizard,
      ts.ScriptKind.TSX,
    ],
    [
      "forensicWizardCheckpointService.ts",
      nextCheckpointService,
      ts.ScriptKind.TS,
    ],
  ];

  for (
    const [
      name,
      source,
      kind,
    ] of parseTargets
  ) {
    const sourceFile =
      ts.createSourceFile(
        name,
        source,
        ts.ScriptTarget.Latest,
        true,
        kind,
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

              return `${name}:${position.line + 1}:${position.character + 1} ${message}`;
            },
          )
          .join(
            "\n",
          );

      fail(
        `TS/TSX parse audit failed:\n${details}`,
      );
    }
  }

  console.log(
    "Checklist + checkpoint TS/TSX parse audit: PASS",
  );
} catch (
  parseError
) {
  if (
    String(
      parseError,
    ).includes(
      "Cannot find module 'typescript'",
    )
  ) {
    console.warn(
      "TypeScript parser unavailable; continuing to full build.",
    );
  } else {
    throw parseError;
  }
}

/* ========================================================================== */
/* Backup.                                                                    */
/* ========================================================================== */

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
      checklistPath:
        path.relative(
          root,
          checklistPath,
        ),
      wizardPath:
        path.relative(
          root,
          wizardPath,
        ),
      wizardCssPath:
        path.relative(
          root,
          wizardCssPath,
        ),
      checkpointServicePath:
        path.relative(
          root,
          checkpointServicePath,
        ),
      originalChecklist,
      originalWizard,
      originalWizardCss,
      originalCheckpointService,
    },
    null,
    2,
  ),
  "utf8",
);

function restore() {
  fs.writeFileSync(
    checklistPath,
    originalChecklist,
    "utf8",
  );

  fs.writeFileSync(
    wizardPath,
    originalWizard,
    "utf8",
  );

  fs.writeFileSync(
    wizardCssPath,
    originalWizardCss,
    "utf8",
  );

  if (
    originalCheckpointService ===
    null
  ) {
    fs.rmSync(
      checkpointServicePath,
      {
        force: true,
      },
    );
  } else {
    fs.writeFileSync(
      checkpointServicePath,
      originalCheckpointService,
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

/* ========================================================================== */
/* Write.                                                                     */
/* ========================================================================== */

fs.writeFileSync(
  checklistPath,
  checklist,
  "utf8",
);

fs.writeFileSync(
  wizardPath,
  nextWizard,
  "utf8",
);

fs.writeFileSync(
  wizardCssPath,
  nextWizardCss,
  "utf8",
);

fs.writeFileSync(
  checkpointServicePath,
  nextCheckpointService,
  "utf8",
);

console.log(
  "WROTE src/services/forensicWizardCheckpointService.ts",
);

console.log(
  "REPLACED wizard navigation with durable committed checkpoints.",
);

/* ========================================================================== */
/* Full project build.                                                        */
/* ========================================================================== */

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
    "RoadSafe Checklist Theme + Wizard Checkpoints V1",
    "================================================",
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
    "Build failed. Restoring checklist and wizard...",
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
  "RoadSafe Checklist Theme + Wizard Checkpoints V1 installed successfully.",
);

console.log("");
console.log(
  "Wizard checkpoints:",
);

console.log(
  "  Case -> saved before Area unlocks",
);

console.log(
  "  Area -> saved before Build unlocks",
);

console.log(
  "  Build -> full result saved before Review unlocks",
);

console.log(
  "  Build error -> rebounds to saved Area state and Build retry",
);

console.log(
  "  Refresh/reopen -> restores latest valid checkpoint",
);

console.log(
  "  Case creation -> clears new-case checkpoint",
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
  "  node revoke-checklist-theme-wizard-checkpoints-v1.mjs",
);
