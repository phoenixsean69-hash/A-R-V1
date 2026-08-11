import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const root =
  process.cwd();

const scriptDir =
  path.dirname(
    new URL(
      import.meta.url,
    ).pathname.replace(
      /^\/([A-Za-z]:)/,
      "$1",
    ),
  );

const packagePath =
  path.join(
    root,
    "package.json",
  );

const mainPath =
  path.join(
    root,
    "src/main.tsx",
  );

const indexCssPath =
  path.join(
    root,
    "src/index.css",
  );

const darkerThemePath =
  path.join(
    root,
    "src/styles/darkerTheme.css",
  );

const workstationPath =
  path.join(
    root,
    "src/styles/workstationPanelSystem.css",
  );

const blenderGuardPath =
  path.join(
    root,
    "src/styles/blenderColorGuard.css",
  );

const palettePath =
  path.join(
    root,
    "src/styles/roadsafePalette.css",
  );

const palettePayloadPath =
  path.join(
    scriptDir,
    "roadsafePalette.css",
  );

const viewerPath =
  path.join(
    root,
    "src/components/reconstruction/Reconstruction3DViewer.tsx",
  );

const participant2DPath =
  path.join(
    root,
    "src/components/reconstruction/Participant2DModel.tsx",
  );

const optionalGizmoPaths = [
  path.join(
    root,
    "src/components/reconstruction/transformGizmo2D.css",
  ),
  path.join(
    root,
    "src/components/reconstruction/universalTransformGizmo.css",
  ),
];

const backupRoot =
  path.join(
    root,
    ".roadsafe-ui-backup",
  );

const statePath =
  path.join(
    backupRoot,
    "last-palette-everywhere-v1.json",
  );

const buildLogPath =
  path.join(
    backupRoot,
    "palette-everywhere-v1-build.log",
  );

const auditPath =
  path.join(
    backupRoot,
    "palette-everywhere-v1-audit.txt",
  );

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

function normalizeEol(
  source,
) {
  return source
    .replace(
      /\r\n/g,
      "\n",
    )
    .replace(
      /\r/g,
      "\n",
    );
}

function detectEol(
  source,
) {
  return source.includes(
    "\r\n",
  )
    ? "\r\n"
    : "\n";
}

function restoreEol(
  source,
  original,
) {
  return detectEol(
    original,
  ) ===
    "\r\n"
    ? source.replace(
        /\n/g,
        "\r\n",
      )
    : source;
}

function readRequired(
  filePath,
) {
  if (
    !fs.existsSync(
      filePath,
    )
  ) {
    fail(
      `Required RoadSafe source file missing: ${filePath}`,
    );
  }

  return fs.readFileSync(
    filePath,
    "utf8",
  );
}

function patchCssVariable(
  source,
  name,
  value,
) {
  const escaped =
    name.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

  const pattern =
    new RegExp(
      `(^\\s*${escaped}\\s*:\\s*)[^;]+;`,
      "m",
    );

  if (
    !pattern.test(
      source,
    )
  ) {
    return source;
  }

  return source.replace(
    pattern,
    `$1${value};`,
  );
}

function findStatementEnd(
  source,
  startIndex,
) {
  let quote =
    null;

  let roundDepth =
    0;

  let squareDepth =
    0;

  let curlyDepth =
    0;

  for (
    let index =
      startIndex;
    index <
      source.length;
    index +=
      1
  ) {
    const character =
      source[
        index
      ];

    if (
      quote
    ) {
      if (
        character ===
          "\\" &&
        index +
          1 <
          source.length
      ) {
        index +=
          1;

        continue;
      }

      if (
        character ===
        quote
      ) {
        quote =
          null;
      }

      continue;
    }

    if (
      character ===
        '"' ||
      character ===
        "'" ||
      character ===
        "`"
    ) {
      quote =
        character;

      continue;
    }

    if (
      character ===
      "("
    ) {
      roundDepth +=
        1;

      continue;
    }

    if (
      character ===
      ")"
    ) {
      roundDepth =
        Math.max(
          0,
          roundDepth -
            1,
        );

      continue;
    }

    if (
      character ===
      "["
    ) {
      squareDepth +=
        1;

      continue;
    }

    if (
      character ===
      "]"
    ) {
      squareDepth =
        Math.max(
          0,
          squareDepth -
            1,
        );

      continue;
    }

    if (
      character ===
      "{"
    ) {
      curlyDepth +=
        1;

      continue;
    }

    if (
      character ===
      "}"
    ) {
      curlyDepth =
        Math.max(
          0,
          curlyDepth -
            1,
        );

      continue;
    }

    if (
      character ===
        ";" &&
      roundDepth ===
        0 &&
      squareDepth ===
        0 &&
      curlyDepth ===
        0
    ) {
      return (
        index +
        1
      );
    }
  }

  return -1;
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

const originals = {
  main:
    readRequired(
      mainPath,
    ),

  indexCss:
    readRequired(
      indexCssPath,
    ),

  darkerTheme:
    fs.existsSync(
      darkerThemePath,
    )
      ? fs.readFileSync(
          darkerThemePath,
          "utf8",
        )
      : null,

  workstation:
    fs.existsSync(
      workstationPath,
    )
      ? fs.readFileSync(
          workstationPath,
          "utf8",
        )
      : null,

  blenderGuard:
    fs.existsSync(
      blenderGuardPath,
    )
      ? fs.readFileSync(
          blenderGuardPath,
          "utf8",
        )
      : null,

  palette:
    fs.existsSync(
      palettePath,
    )
      ? fs.readFileSync(
          palettePath,
          "utf8",
        )
      : null,

  viewer:
    fs.existsSync(
      viewerPath,
    )
      ? fs.readFileSync(
          viewerPath,
          "utf8",
        )
      : null,

  participant2D:
    fs.existsSync(
      participant2DPath,
    )
      ? fs.readFileSync(
          participant2DPath,
          "utf8",
        )
      : null,

  gizmos:
    optionalGizmoPaths.map(
      (
        filePath,
      ) => ({
        filePath,

        content:
          fs.existsSync(
            filePath,
          )
            ? fs.readFileSync(
                filePath,
                "utf8",
              )
            : null,
      }),
    ),
};

let main =
  normalizeEol(
    originals.main,
  );

let indexCss =
  normalizeEol(
    originals.indexCss,
  );

let darkerTheme =
  originals.darkerTheme ===
    null
    ? null
    : normalizeEol(
        originals.darkerTheme,
      );

let workstation =
  originals.workstation ===
    null
    ? null
    : normalizeEol(
        originals.workstation,
      );

let blenderGuard =
  originals.blenderGuard ===
    null
    ? null
    : normalizeEol(
        originals.blenderGuard,
      );

let viewer =
  originals.viewer ===
    null
    ? null
    : normalizeEol(
        originals.viewer,
      );

let participant2D =
  originals.participant2D ===
    null
    ? null
    : normalizeEol(
        originals.participant2D,
      );

const palette =
  readRequired(
    palettePayloadPath,
  );

/* ====================================================================== */
/* 1. Canonical variable migration.                                       */
/* ====================================================================== */

const indexVariables =
  new Map([
    [
      "--bg-base",
      "#3C3C3C",
    ],
    [
      "--bg-panel",
      "#C1C1C1",
    ],
    [
      "--bg-card",
      "#C1C1C1",
    ],
    [
      "--bg-control",
      "#C1C1C1",
    ],
    [
      "--bg-control-hover",
      "#C69D56",
    ],
    [
      "--border-strong",
      "#181818",
    ],
    [
      "--border-mid",
      "#3C3C3C",
    ],
    [
      "--border-soft",
      "#3C3C3C",
    ],
    [
      "--selection",
      "#C69D56",
    ],
    [
      "--context-blue",
      "#4874CB",
    ],
    [
      "--success-muted",
      "#8FD1AB",
    ],
  ]);

for (
  const [
    name,
    value,
  ] of indexVariables
) {
  indexCss =
    patchCssVariable(
      indexCss,
      name,
      value,
    );
}

if (
  darkerTheme
) {
  const variables =
    new Map([
      [
        "--js-shell",
        "#3C3C3C",
      ],
      [
        "--js-sidebar",
        "#181818",
      ],
      [
        "--js-workspace",
        "#3C3C3C",
      ],
      [
        "--js-inspector",
        "#C1C1C1",
      ],
      [
        "--js-panel",
        "#C1C1C1",
      ],
      [
        "--js-panel-raised",
        "#C1C1C1",
      ],
      [
        "--js-panel-hover",
        "#C69D56",
      ],
      [
        "--js-border-subtle",
        "#181818",
      ],
      [
        "--js-border-default",
        "#3C3C3C",
      ],
      [
        "--js-border-strong",
        "#181818",
      ],
      [
        "--js-blue-muted",
        "#4874CB",
      ],
      [
        "--js-blue-active",
        "#4874CB",
      ],
      [
        "--js-blue-selected",
        "#C69D56",
      ],
      [
        "--js-blue-soft-bg",
        "#C1C1C1",
      ],
      [
        "--js-green-muted",
        "#8FD1AB",
      ],
      [
        "--js-green-bg",
        "#8FD1AB",
      ],
      [
        "--js-info-muted",
        "#4874CB",
      ],
      [
        "--js-amber-muted",
        "#C69D56",
      ],
      [
        "--js-amber-bg",
        "#C69D56",
      ],
    ]);

  for (
    const [
      name,
      value,
    ] of variables
  ) {
    darkerTheme =
      patchCssVariable(
        darkerTheme,
        name,
        value,
      );
  }
}

if (
  workstation
) {
  const variables =
    new Map([
      [
        "--workstation-panel-surface",
        "#C1C1C1",
      ],
      [
        "--workstation-panel-header",
        "#C1C1C1",
      ],
      [
        "--workstation-panel-section",
        "#C1C1C1",
      ],
      [
        "--workstation-panel-section-header",
        "#C1C1C1",
      ],
      [
        "--workstation-panel-raised",
        "#C1C1C1",
      ],
      [
        "--workstation-input",
        "#C1C1C1",
      ],
      [
        "--workstation-control-top",
        "#C1C1C1",
      ],
      [
        "--workstation-control-bottom",
        "#C1C1C1",
      ],
      [
        "--workstation-panel-border",
        "#181818",
      ],
      [
        "--workstation-panel-border-soft",
        "#3C3C3C",
      ],
      [
        "--workstation-panel-border-strong",
        "#181818",
      ],
      [
        "--workstation-panel-text",
        "#181818",
      ],
      [
        "--workstation-panel-text-secondary",
        "#181818",
      ],
      [
        "--workstation-panel-muted",
        "#3C3C3C",
      ],
      [
        "--workstation-accent",
        "#C69D56",
      ],
    ]);

  for (
    const [
      name,
      value,
    ] of variables
  ) {
    workstation =
      patchCssVariable(
        workstation,
        name,
        value,
      );
  }
}

if (
  blenderGuard
) {
  const variables =
    new Map([
      [
        "--roadsafe-ui-accent",
        "#C69D56",
      ],
      [
        "--roadsafe-ui-shell",
        "#3C3C3C",
      ],
      [
        "--roadsafe-ui-workspace",
        "#3C3C3C",
      ],
      [
        "--roadsafe-ui-panel",
        "#C1C1C1",
      ],
      [
        "--roadsafe-ui-section",
        "#C1C1C1",
      ],
      [
        "--roadsafe-ui-raised",
        "#C1C1C1",
      ],
      [
        "--roadsafe-ui-hover",
        "#C69D56",
      ],
      [
        "--roadsafe-ui-input",
        "#C1C1C1",
      ],
      [
        "--roadsafe-ui-border",
        "#181818",
      ],
      [
        "--roadsafe-ui-border-mid",
        "#3C3C3C",
      ],
      [
        "--roadsafe-ui-border-strong",
        "#181818",
      ],
      [
        "--roadsafe-ui-text",
        "#181818",
      ],
      [
        "--roadsafe-ui-text-secondary",
        "#181818",
      ],
      [
        "--roadsafe-ui-muted",
        "#3C3C3C",
      ],
    ]);

  for (
    const [
      name,
      value,
    ] of variables
  ) {
    blenderGuard =
      patchCssVariable(
        blenderGuard,
        name,
        value,
      );
  }
}

/* ====================================================================== */
/* 2. Import the final palette LAST.                                       */
/* ====================================================================== */

const paletteImport =
  'import "./styles/roadsafePalette.css";';

if (
  !main.includes(
    paletteImport,
  )
) {
  const lines =
    main.split(
      "\n",
    );

  let lastCssImport =
    -1;

  for (
    let index =
      0;
    index <
      lines.length;
    index +=
      1
  ) {
    if (
      /^import\s+["'][^"']+\.css["'];?$/.test(
        lines[
          index
        ].trim(),
      )
    ) {
      lastCssImport =
        index;
    }
  }

  if (
    lastCssImport <
    0
  ) {
    fail(
      "Could not locate the global CSS import stack in src/main.tsx. No files changed.",
    );
  }

  lines.splice(
    lastCssImport +
      1,
    0,
    paletteImport,
  );

  main =
    lines.join(
      "\n",
    );
}

const paletteImportIndex =
  main.indexOf(
    paletteImport,
  );

const oldGuardImportIndex =
  main.indexOf(
    'import "./styles/blenderColorGuard.css";',
  );

if (
  oldGuardImportIndex >=
    0 &&
  paletteImportIndex <=
    oldGuardImportIndex
) {
  fail(
    "roadsafePalette.css is not after blenderColorGuard.css. No files changed.",
  );
}

/* ====================================================================== */
/* 3. True 3D viewport background.                                        */
/* ====================================================================== */

if (
  viewer
) {
  const backgroundMarker =
    "scene.background = new THREE.Color(";

  const markerIndex =
    viewer.indexOf(
      backgroundMarker,
    );

  if (
    markerIndex >=
    0
  ) {
    const statementStart =
      viewer.lastIndexOf(
        "\n",
        markerIndex,
      ) +
      1;

    const statementEnd =
      findStatementEnd(
        viewer,
        markerIndex,
      );

    if (
      statementEnd <
      0
    ) {
      fail(
        "Could not isolate Three.js scene background statement. No files changed.",
      );
    }

    const indent =
      viewer
        .slice(
          statementStart,
          markerIndex,
        )
        .match(
          /^[ \t]*/,
        )?.[0] ??
      "";

    viewer =
      viewer.slice(
        0,
        statementStart,
      ) +
`${indent}scene.background =
${indent}  new THREE.Color(
${indent}    0x555555,
${indent}  );` +
      viewer.slice(
        statementEnd,
      );
  }

  if (
    !viewer.includes(
      "0x555555"
    )
  ) {
    fail(
      "3D viewport palette audit failed: #555555 scene background not found. No files changed.",
    );
  }
}

/* ====================================================================== */
/* 4. Selection glow + optional gizmo palette.                             */
/* ====================================================================== */

if (
  participant2D
) {
  participant2D =
    participant2D
      .replace(
        /rgba\(\s*232\s*,\s*135\s*,\s*45\s*,\s*0\.95\s*\)/gi,
        "rgba(198, 157, 86, 0.95)",
      )
      .replace(
        /#e8872d/gi,
        "#C69D56",
      );
}

const patchedGizmos =
  originals.gizmos.map(
    (
      item,
    ) => {
      if (
        item.content ===
        null
      ) {
        return {
          ...item,

          patched:
            null,
        };
      }

      let content =
        normalizeEol(
          item.content,
        );

      content =
        content
          .replace(
            /#e8872d/gi,
            "#C69D56",
          )
          .replace(
            /rgba\(\s*232\s*,\s*135\s*,\s*45\s*,/gi,
            "rgba(198, 157, 86,",
          )
          .replace(
            /#b95a56/gi,
            "#4874CB",
          )
          .replace(
            /#b5534f/gi,
            "#4874CB",
          )
          .replace(
            /#64a36e/gi,
            "#8FD1AB",
          )
          .replace(
            /#5d9b66/gi,
            "#8FD1AB",
          );

      return {
        ...item,

        patched:
          content,
      };
    },
  );

/* ====================================================================== */
/* 5. Palette file validation.                                             */
/* ====================================================================== */

for (
  const colour of [
    "#181818",
    "#3C3C3C",
    "#555555",
    "#C1C1C1",
    "#C69D56",
    "#8FD1AB",
    "#4874CB",
  ]
) {
  if (
    !palette.includes(
      colour,
    )
  ) {
    fail(
      `Palette payload is missing ${colour}. No files changed.`,
    );
  }
}

let cssDepth =
  0;

for (
  const character of
    palette
) {
  if (
    character ===
    "{"
  ) {
    cssDepth +=
      1;
  } else if (
    character ===
    "}"
  ) {
    cssDepth -=
      1;
  }

  if (
    cssDepth <
    0
  ) {
    fail(
      "Palette CSS brace audit failed. No files changed.",
    );
  }
}

if (
  cssDepth !==
  0
) {
  fail(
    "Palette CSS brace audit failed. No files changed.",
  );
}

/* ====================================================================== */
/* 6. Parse changed TS/TSX before write.                                  */
/* ====================================================================== */

try {
  const require =
    createRequire(
      import.meta.url,
    );

  const ts =
    require(
      "typescript",
    );

  const targets = [
    [
      "main.tsx",
      main,
      ts.ScriptKind.TSX,
    ],
  ];

  if (
    viewer
  ) {
    targets.push([
      "Reconstruction3DViewer.tsx",
      viewer,
      ts.ScriptKind.TSX,
    ]);
  }

  if (
    participant2D
  ) {
    targets.push([
      "Participant2DModel.tsx",
      participant2D,
      ts.ScriptKind.TSX,
    ]);
  }

  for (
    const [
      name,
      source,
      kind,
    ] of targets
  ) {
    const file =
      ts.createSourceFile(
        name,
        source,
        ts.ScriptTarget.Latest,
        true,
        kind,
      );

    if (
      file.parseDiagnostics.length >
      0
    ) {
      const details =
        file.parseDiagnostics
          .slice(
            0,
            30,
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
                file
                  .getLineAndCharacterOfPosition(
                    diagnostic.start,
                  );

              return `${name}:${position.line + 1}:${position.character + 1} ${message}`;
            },
          )
          .join(
            "\n",
          );

      fail(
        `Palette TypeScript parse audit failed:\n${details}`,
      );
    }
  }

  console.log(
    "Palette TypeScript parse audit: PASS",
  );
} catch (
  error
) {
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

/* ====================================================================== */
/* 7. Backup exact originals.                                              */
/* ====================================================================== */

fs.mkdirSync(
  backupRoot,
  {
    recursive:
      true,
  },
);

fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      installedAt:
        new Date().toISOString(),

      originals,
    },
    null,
    2,
  ),
  "utf8",
);

function restoreOptional(
  filePath,
  content,
) {
  if (
    content ===
    null
  ) {
    fs.rmSync(
      filePath,
      {
        force:
          true,
      },
    );

    return;
  }

  fs.writeFileSync(
    filePath,
    content,
    "utf8",
  );
}

function restore() {
  fs.writeFileSync(
    mainPath,
    originals.main,
    "utf8",
  );

  fs.writeFileSync(
    indexCssPath,
    originals.indexCss,
    "utf8",
  );

  restoreOptional(
    darkerThemePath,
    originals.darkerTheme,
  );

  restoreOptional(
    workstationPath,
    originals.workstation,
  );

  restoreOptional(
    blenderGuardPath,
    originals.blenderGuard,
  );

  restoreOptional(
    palettePath,
    originals.palette,
  );

  restoreOptional(
    viewerPath,
    originals.viewer,
  );

  restoreOptional(
    participant2DPath,
    originals.participant2D,
  );

  for (
    const gizmo of
      originals.gizmos
  ) {
    restoreOptional(
      gizmo.filePath,
      gizmo.content,
    );
  }

  fs.rmSync(
    statePath,
    {
      force:
        true,
    },
  );
}

/* ====================================================================== */
/* 8. Write theme system.                                                  */
/* ====================================================================== */

fs.writeFileSync(
  mainPath,
  restoreEol(
    main,
    originals.main,
  ),
  "utf8",
);

fs.writeFileSync(
  indexCssPath,
  restoreEol(
    indexCss,
    originals.indexCss,
  ),
  "utf8",
);

if (
  darkerTheme !==
  null &&
  originals.darkerTheme !==
    null
) {
  fs.writeFileSync(
    darkerThemePath,
    restoreEol(
      darkerTheme,
      originals.darkerTheme,
    ),
    "utf8",
  );
}

if (
  workstation !==
  null &&
  originals.workstation !==
    null
) {
  fs.writeFileSync(
    workstationPath,
    restoreEol(
      workstation,
      originals.workstation,
    ),
    "utf8",
  );
}

if (
  blenderGuard !==
  null &&
  originals.blenderGuard !==
    null
) {
  fs.writeFileSync(
    blenderGuardPath,
    restoreEol(
      blenderGuard,
      originals.blenderGuard,
    ),
    "utf8",
  );
}

fs.writeFileSync(
  palettePath,
  palette,
  "utf8",
);

if (
  viewer !==
  null &&
  originals.viewer !==
    null
) {
  fs.writeFileSync(
    viewerPath,
    restoreEol(
      viewer,
      originals.viewer,
    ),
    "utf8",
  );
}

if (
  participant2D !==
  null &&
  originals.participant2D !==
    null
) {
  fs.writeFileSync(
    participant2DPath,
    restoreEol(
      participant2D,
      originals.participant2D,
    ),
    "utf8",
  );
}

for (
  let index =
    0;
  index <
    patchedGizmos.length;
  index +=
    1
) {
  const gizmo =
    patchedGizmos[
      index
    ];

  const originalGizmo =
    originals.gizmos[
      index
    ];

  if (
    gizmo.patched ===
      null ||
    originalGizmo.content ===
      null
  ) {
    continue;
  }

  fs.writeFileSync(
    gizmo.filePath,
    restoreEol(
      gizmo.patched,
      originalGizmo.content,
    ),
    "utf8",
  );
}

/* ====================================================================== */
/* 9. Create post-write palette audit.                                     */
/* ====================================================================== */

const auditLines = [
  "RoadSafe Palette Everywhere V1",
  "===============================",
  "",
  "Canonical palette:",
  "  #181818 secondary / deep chrome",
  "  #3C3C3C main application surface",
  "  #555555 2D / 3D / AR viewports",
  "  #C1C1C1 buttons / panels / controls",
  "  #C69D56 warm selection / attention",
  "  #8FD1AB verified / success",
  "  #4874CB primary blue / information / focus",
  "",
  `Final palette imported: ${main.includes(
    paletteImport,
  ) ? "YES" : "NO"}`,
  `Final palette after Blender guard: ${
    main.indexOf(
      paletteImport,
    ) >
    main.indexOf(
      'import "./styles/blenderColorGuard.css";',
    )
      ? "YES"
      : "NO"
  }`,
  `3D #555555 background: ${
    viewer?.includes(
      "0x555555",
    )
      ? "YES"
      : "N/A"
  }`,
  `2D selection accent migrated: ${
    participant2D?.includes(
      "#C69D56",
    ) ||
    participant2D?.includes(
      "198, 157, 86",
    )
      ? "YES"
      : "N/A"
  }`,
  `Optional gizmo palette files found: ${
    originals.gizmos.filter(
      (
        item,
      ) =>
        item.content !==
        null,
    ).length
  }`,
  "",
  "NOTE:",
  "Scene-semantic colours (traffic signs, vegetation artwork, evidence meaning,",
  "hazard meaning, etc.) are intentionally not blanket-replaced by the UI theme.",
];

fs.writeFileSync(
  auditPath,
  auditLines.join(
    "\n",
  ),
  "utf8",
);

console.log(
  "PATCHED canonical RoadSafe palette variables.",
);

console.log(
  "ADDED roadsafePalette.css as the final stylesheet.",
);

console.log(
  "PATCHED 3D neutral viewport background to #555555.",
);

console.log(
  "PATCHED reconstruction selection/gizmo accent to #C69D56 where present.",
);

console.log(
  "Palette audit written to .roadsafe-ui-backup\\palette-everywhere-v1-audit.txt",
);

/* ====================================================================== */
/* 10. Full build.                                                         */
/* ====================================================================== */

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

const output = [
  "RoadSafe Palette Everywhere V1",
  "===============================",
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
    "Build failed. Restoring the exact pre-theme files...",
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
  "RoadSafe Palette Everywhere V1 installed successfully.",
);

console.log("");
console.log(
  "Palette:",
);

console.log(
  "  #181818 secondary",
);

console.log(
  "  #3C3C3C main",
);

console.log(
  "  #555555 2D / 3D / AR viewport",
);

console.log(
  "  #C1C1C1 buttons + panels",
);

console.log(
  "  #C69D56 warm accent",
);

console.log(
  "  #8FD1AB verified / success",
);

console.log(
  "  #4874CB blue / focus / primary",
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
  "  node revoke-palette-everywhere-v1.mjs",
);
