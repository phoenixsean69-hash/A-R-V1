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

const editorPath =
  path.join(
    root,
    "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  );

const cssPath =
  path.join(
    root,
    "src/components/reconstruction/orthographic2D.css",
  );

const payloadCssPath =
  path.join(
    scriptDir,
    "orthographic2D.css",
  );

const backupRoot =
  path.join(
    root,
    ".roadsafe-ui-backup",
  );

const statePath =
  path.join(
    backupRoot,
    "last-true-orthographic-2d-v1.json",
  );

const buildLogPath =
  path.join(
    backupRoot,
    "true-orthographic-2d-v1-build.log",
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

function replaceOnce(
  source,
  before,
  after,
  label,
) {
  const index =
    source.indexOf(
      before,
    );

  if (
    index <
    0
  ) {
    fail(
      `Could not locate ${label}. No files changed.`,
    );
  }

  if (
    source.indexOf(
      before,
      index +
        before.length,
    ) >=
    0
  ) {
    fail(
      `Found multiple ${label} anchors. No files changed.`,
    );
  }

  return (
    source.slice(
      0,
      index,
    ) +
    after +
    source.slice(
      index +
        before.length,
    )
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

if (
  !fs.existsSync(
    editorPath,
  )
) {
  fail(
    "AccidentReconstructionEditor.tsx was not found.",
  );
}

if (
  !fs.existsSync(
    payloadCssPath,
  )
) {
  fail(
    "Installer payload orthographic2D.css is missing.",
  );
}

const originalEditor =
  fs.readFileSync(
    editorPath,
    "utf8",
  );

const originalCss =
  fs.existsSync(
    cssPath,
  )
    ? fs.readFileSync(
        cssPath,
        "utf8",
      )
    : null;

let editor =
  originalEditor;

/* ====================================================================== */
/* CSS import.                                                             */
/* ====================================================================== */

if (
  !editor.includes(
    'import "./orthographic2D.css";',
  )
) {
  const cssAnchor =
    'import "./participantPlacement.css";';

  if (
    !editor.includes(
      cssAnchor,
    )
  ) {
    fail(
      "Could not locate reconstruction CSS import anchor. No files changed.",
    );
  }

  editor =
    replaceOnce(
      editor,
      cssAnchor,
      `${cssAnchor}
import "./orthographic2D.css";`,
      "participantPlacement.css import",
    );
}

/* ====================================================================== */
/* Dedicated metric-plane ref.                                            */
/* ====================================================================== */

if (
  !editor.includes(
    "sceneMetricPlaneRef",
  )
) {
  const refAnchor =
`  const sceneRef = useRef<HTMLDivElement | null>(null);
  const sceneViewportRef = useRef<HTMLDivElement | null>(null);`;

  editor =
    replaceOnce(
      editor,
      refAnchor,
`  const sceneRef = useRef<HTMLDivElement | null>(null);
  const sceneViewportRef = useRef<HTMLDivElement | null>(null);

  /**
   * The actual metric 2D sheet. Unlike sceneRef/sceneViewportRef (the browser
   * workspace), this element preserves the real scene aspect ratio.
   */
  const sceneMetricPlaneRef =
    useRef<HTMLDivElement | null>(
      null,
    );`,
      "2D scene refs",
    );
}

/* ====================================================================== */
/* Metric frame state.                                                     */
/* ====================================================================== */

if (
  !editor.includes(
    "sceneMetricFrame",
  )
) {
  const viewState =
`  const [sceneView, setSceneView] = useState({ zoom: MIN_SCENE_ZOOM, panX: 0, panY: 0 });`;

  editor =
    replaceOnce(
      editor,
      viewState,
`${viewState}

  const [
    sceneMetricFrame,
    setSceneMetricFrame,
  ] = useState({
    widthPx: 1,
    heightPx: 1,
    pixelsPerMetre: 1,
  });`,
      "sceneView state",
    );
}

/* ====================================================================== */
/* Uniform px/metre frame calculation.                                     */
/* ====================================================================== */

if (
  !editor.includes(
    "updateOrthographicMetricFrame",
  )
) {
  const clientMapperAnchor =
`  const clientToScenePosition = useCallback((clientX: number, clientY: number) => {`;

  const effect =
`  const sceneWorldDimensions2D =
    getReconstructionWorldDimensions(
      reconstruction,
    );

  useEffect(() => {
    if (
      activeReconstructionView !==
      "2D"
    ) {
      return;
    }

    const viewport =
      sceneViewportRef.current;

    if (!viewport) {
      return;
    }

    const updateOrthographicMetricFrame =
      () => {
        const rectangle =
          viewport.getBoundingClientRect();

        const availableWidth =
          Math.max(
            1,
            rectangle.width,
          );

        const availableHeight =
          Math.max(
            1,
            rectangle.height,
          );

        /*
         * ONE scale for both axes. This is the defining property of an
         * orthographic plan view and eliminates the old wide-screen stretch.
         */
        const pixelsPerMetre =
          Math.max(
            0.0001,
            Math.min(
              availableWidth /
                sceneWorldDimensions2D.widthMetres,
              availableHeight /
                sceneWorldDimensions2D.heightMetres,
            ),
          );

        const widthPx =
          sceneWorldDimensions2D.widthMetres *
          pixelsPerMetre;

        const heightPx =
          sceneWorldDimensions2D.heightMetres *
          pixelsPerMetre;

        setSceneMetricFrame(
          (
            current,
          ) => {
            if (
              Math.abs(
                current.widthPx -
                  widthPx,
              ) <
                0.5 &&
              Math.abs(
                current.heightPx -
                  heightPx,
              ) <
                0.5 &&
              Math.abs(
                current.pixelsPerMetre -
                  pixelsPerMetre,
              ) <
                0.0001
            ) {
              return current;
            }

            return {
              widthPx,
              heightPx,
              pixelsPerMetre,
            };
          },
        );
      };

    updateOrthographicMetricFrame();

    const observer =
      typeof ResizeObserver !==
      "undefined"
        ? new ResizeObserver(
            updateOrthographicMetricFrame,
          )
        : null;

    observer?.observe(
      viewport,
    );

    window.addEventListener(
      "resize",
      updateOrthographicMetricFrame,
    );

    return () => {
      observer?.disconnect();

      window.removeEventListener(
        "resize",
        updateOrthographicMetricFrame,
      );
    };
  }, [
    activeReconstructionView,
    sceneWorldDimensions2D.heightMetres,
    sceneWorldDimensions2D.widthMetres,
  ]);

`;

  if (
    !editor.includes(
      clientMapperAnchor,
    )
  ) {
    fail(
      "Could not locate clientToScenePosition. No files changed.",
    );
  }

  editor =
    editor.replace(
      clientMapperAnchor,
      effect +
        clientMapperAnchor,
    );
}

/* ====================================================================== */
/* Pointer mapping now uses the transformed metric sheet itself.           */
/* ====================================================================== */

const oldClientMapper =
`  const clientToScenePosition = useCallback((clientX: number, clientY: number) => {
    const rectangle = sceneRef.current?.getBoundingClientRect();
    if (!rectangle) return null;
    const localX = (clientX - rectangle.left - rectangle.width / 2 - sceneView.panX) / sceneView.zoom + rectangle.width / 2;
    const localY = (clientY - rectangle.top - rectangle.height / 2 - sceneView.panY) / sceneView.zoom + rectangle.height / 2;
    return {
      x: clamp((localX / rectangle.width) * 100, 0, 100),
      y: clamp((localY / rectangle.height) * 100, 0, 100),
    };
  }, [sceneView]);`;

const newClientMapper =
`  const clientToScenePosition = useCallback(
    (
      clientX: number,
      clientY: number,
    ) => {
      /*
       * getBoundingClientRect() includes the current pan + uniform zoom.
       * Mapping directly through this transformed rectangle keeps pointer
       * placement exactly aligned with the orthographic metric sheet.
       */
      const rectangle =
        sceneMetricPlaneRef.current
          ?.getBoundingClientRect();

      if (
        !rectangle ||
        rectangle.width <= 0 ||
        rectangle.height <= 0
      ) {
        return null;
      }

      const xProgress =
        (
          clientX -
          rectangle.left
        ) /
        rectangle.width;

      const yProgress =
        (
          clientY -
          rectangle.top
        ) /
        rectangle.height;

      /*
       * Letterboxed viewport space is NOT forensic scene space. Ignore
       * placement/drawing clicks outside the metric sheet instead of clamping
       * them onto a fake scene edge.
       */
      if (
        xProgress < 0 ||
        xProgress > 1 ||
        yProgress < 0 ||
        yProgress > 1
      ) {
        return null;
      }

      return {
        x:
          xProgress *
          100,

        y:
          yProgress *
          100,
      };
    },
    [],
  );`;

if (
  editor.includes(
    oldClientMapper,
  )
) {
  editor =
    replaceOnce(
      editor,
      oldClientMapper,
      newClientMapper,
      "legacy viewport percentage mapper",
    );
} else if (
  !editor.includes(
    "sceneMetricPlaneRef.current",
  )
) {
  fail(
    "Could not replace legacy 2D pointer projection. No files changed.",
  );
}

/* ====================================================================== */
/* Replace the stretched full-viewport plane with the centred metric plane.*/
/* ====================================================================== */

const oldPlane =
`              <div
                className="absolute inset-0 origin-center"
                style={{ transform: \`translate(\${sceneView.panX}px, \${sceneView.panY}px) scale(\${sceneView.zoom})\` }}
              >`;

const newPlane =
`              <div
                ref={
                  sceneMetricPlaneRef
                }
                data-roadsafe-2d-projection="true-orthographic-metric"
                className="roadsafe-2d-orthographic-plane origin-center"
                style={{
                  width:
                    \`\${sceneMetricFrame.widthPx}px\`,

                  height:
                    \`\${sceneMetricFrame.heightPx}px\`,

                  /*
                   * The base sheet is centred in the viewport. Pan is applied
                   * in screen pixels; zoom remains uniform on both axes.
                   */
                  transform:
                    \`translate(calc(-50% + \${sceneView.panX}px), calc(-50% + \${sceneView.panY}px)) scale(\${sceneView.zoom})\`,
                }}
              >`;

if (
  editor.includes(
    oldPlane,
  )
) {
  editor =
    replaceOnce(
      editor,
      oldPlane,
      newPlane,
      "legacy stretched 2D scene plane",
    );
} else if (
  !editor.includes(
    'data-roadsafe-2d-projection="true-orthographic-metric"',
  )
) {
  fail(
    "Could not locate the current 2D scene plane. No files changed.",
  );
}

/* ====================================================================== */
/* Add a tiny scale readout to existing map controls, not another panel.   */
/* ====================================================================== */

if (
  !editor.includes(
    "data-roadsafe-orthographic-scale",
  )
) {
  const zoomLabel =
`                <span className="self-center text-center text-[9px] font-black" title="Current map zoom">{Math.round(sceneView.zoom * 100)}%</span>`;

  const nextZoomLabel =
`                <span
                  data-roadsafe-orthographic-scale="true"
                  className="self-center text-center text-[8px] font-black"
                  title={\`Orthographic fit · \${(
                    sceneMetricFrame.pixelsPerMetre *
                    sceneView.zoom
                  ).toFixed(2)} px/m\`}
                >
                  {Math.round(
                    sceneView.zoom *
                    100,
                  )}%
                </span>`;

  editor =
    replaceOnce(
      editor,
      zoomLabel,
      nextZoomLabel,
      "2D zoom readout",
    );
}

/* ====================================================================== */
/* Verification.                                                          */
/* ====================================================================== */

for (
  const token of [
    'import "./orthographic2D.css";',
    "sceneMetricPlaneRef",
    "sceneMetricFrame",
    "updateOrthographicMetricFrame",
    "pixelsPerMetre",
    'data-roadsafe-2d-projection="true-orthographic-metric"',
    "Letterboxed viewport space is NOT forensic scene space",
  ]
) {
  if (
    !editor.includes(
      token,
    )
  ) {
    fail(
      `Orthographic editor verification failed: ${token}. No files changed.`,
    );
  }
}

if (
  editor.includes(
    'className="absolute inset-0 origin-center"\n                style={{ transform: `translate(${sceneView.panX}px, ${sceneView.panY}px) scale(${sceneView.zoom})` }}',
  )
) {
  fail(
    "Legacy stretched 2D plane survived the patch. No files changed.",
  );
}

/* Parse transformed TSX before touching the repo. */
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
      "AccidentReconstructionEditor.tsx",
      editor,
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
              sourceFile
                .getLineAndCharacterOfPosition(
                  diagnostic.start,
                );

            return (
              `line ${position.line + 1}, ` +
              `column ${position.character + 1}: ` +
              message
            );
          },
        )
        .join(
          "\n",
        );

    fail(
      `Orthographic TSX parse audit failed:\n${details}`,
    );
  }

  console.log(
    "True Orthographic 2D TSX parse audit: PASS",
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
/* Backup + write.                                                         */
/* ====================================================================== */

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

function restore() {
  fs.writeFileSync(
    editorPath,
    originalEditor,
    "utf8",
  );

  if (
    originalCss ===
    null
  ) {
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
  editorPath,
  editor,
  "utf8",
);

fs.writeFileSync(
  cssPath,
  fs.readFileSync(
    payloadCssPath,
    "utf8",
  ),
  "utf8",
);

console.log(
  "PATCHED 2D scene to a uniform metric orthographic plane.",
);

console.log(
  "PATCHED pointer placement to the same transformed metric plane.",
);

/* ====================================================================== */
/* Full build.                                                             */
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

const output =
  [
    "RoadSafe True Orthographic 2D V1",
    "================================",
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
    "Build failed. Restoring the previous 2D projection...",
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
  "RoadSafe True Orthographic 2D V1 installed successfully.",
);

console.log("");
console.log(
  "2D projection:",
);

console.log(
  "  X and Y now share one pixels-per-metre scale",
);

console.log(
  "  whole metric scene fits without aspect distortion",
);

console.log(
  "  roads / participants / paths / evidence / HIT marker share the same plane",
);

console.log(
  "  clicks outside the metric sheet are rejected instead of clamped",
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
  "  node revoke-true-orthographic-2d-v1.mjs",
);
